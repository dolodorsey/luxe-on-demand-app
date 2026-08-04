-- LUXE recruiting execution control plane.
-- Adds atomic work claiming, contact attempt evidence, opt-out protection,
-- stale-lock recovery, and automatic candidate/application linking.
-- This migration never sends outreach and never approves or activates a stylist.

alter table public.luxe_supply_candidates
  add column if not exists outreach_locked_at timestamptz,
  add column if not exists outreach_locked_by text,
  add column if not exists outreach_last_error text,
  add column if not exists outreach_last_channel text;

create table if not exists public.luxe_outreach_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.luxe_supply_candidates(id) on delete cascade,
  event_type text not null check (event_type in (
    'claimed','contacted','follow_up','responded','converted','failed',
    'unsubscribed','invalid','lock_released','application_linked'
  )),
  channel text not null default 'system' check (channel in (
    'email','sms','phone','instagram','manual','system'
  )),
  worker_id text,
  provider_message_id text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.luxe_outreach_events enable row level security;
revoke all on public.luxe_outreach_events from public,anon,authenticated;

create index if not exists luxe_outreach_events_candidate_created_idx
  on public.luxe_outreach_events(candidate_id,created_at desc);
create index if not exists luxe_supply_outreach_claim_idx
  on public.luxe_supply_candidates(outreach_status,next_action_at,priority_score desc)
  where pipeline_stage in ('qualified','contacted') and contact_attempts<5;
create index if not exists luxe_supply_outreach_lock_idx
  on public.luxe_supply_candidates(outreach_locked_at)
  where outreach_locked_at is not null;

create or replace function public.luxe_claim_due_outreach_candidate(
  p_worker_id text default 'luxe-supply-activation-agent'
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_candidate public.luxe_supply_candidates%rowtype;
  v_worker text:=left(coalesce(nullif(trim(p_worker_id),''),'luxe-supply-activation-agent'),120);
begin
  if auth.role()<>'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into v_candidate
  from public.luxe_supply_candidates
  where pipeline_stage in ('qualified','contacted')
    and outreach_status in ('queued','follow_up')
    and contact_attempts<5
    and coalesce(next_action_at,now())<=now()
    and (outreach_locked_at is null or outreach_locked_at<now()-interval '30 minutes')
  order by coalesce(next_action_at,created_at),priority_score desc,id
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update public.luxe_supply_candidates
  set outreach_locked_at=now(),
      outreach_locked_by=v_worker,
      outreach_last_error=null,
      updated_at=now()
  where id=v_candidate.id
  returning * into v_candidate;

  insert into public.luxe_outreach_events(candidate_id,event_type,channel,worker_id,metadata)
  values (
    v_candidate.id,'claimed','system',v_worker,
    jsonb_build_object(
      'pipeline_stage',v_candidate.pipeline_stage,
      'outreach_status',v_candidate.outreach_status,
      'contact_attempts',v_candidate.contact_attempts,
      'priority_score',v_candidate.priority_score,
      'next_action_at',v_candidate.next_action_at
    )
  );

  return jsonb_build_object(
    'candidate_id',v_candidate.id,
    'business_name',v_candidate.business_name,
    'mapped_category_id',v_candidate.mapped_category_id,
    'primary_category',v_candidate.primary_category,
    'city',v_candidate.city,
    'phone',v_candidate.phone,
    'email',v_candidate.email,
    'instagram',v_candidate.instagram,
    'website',v_candidate.website,
    'priority_score',v_candidate.priority_score,
    'contact_attempts',v_candidate.contact_attempts,
    'worker_id',v_worker,
    'claimed_at',v_candidate.outreach_locked_at
  );
end;
$function$;

create or replace function public.luxe_complete_outreach_candidate(
  p_candidate_id uuid,
  p_worker_id text,
  p_outcome text,
  p_channel text default 'manual',
  p_provider_message_id text default null,
  p_notes text default null,
  p_follow_up_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_candidate public.luxe_supply_candidates%rowtype;
  v_worker text:=left(coalesce(nullif(trim(p_worker_id),''),'luxe-supply-activation-agent'),120);
  v_outcome text:=lower(trim(coalesce(p_outcome,'')));
  v_channel text:=lower(trim(coalesce(p_channel,'manual')));
  v_next timestamptz;
begin
  if auth.role()<>'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if v_outcome not in ('contacted','follow_up','responded','converted','failed','unsubscribed','invalid') then
    raise exception 'Unsupported outreach outcome';
  end if;
  if v_channel not in ('email','sms','phone','instagram','manual','system') then
    raise exception 'Unsupported outreach channel';
  end if;

  select * into v_candidate
  from public.luxe_supply_candidates
  where id=p_candidate_id
  for update;

  if not found then raise exception 'Candidate not found'; end if;
  if v_candidate.outreach_locked_by is distinct from v_worker then
    raise exception 'Candidate is not locked by this worker' using errcode='42501';
  end if;
  if v_outcome='converted' and v_candidate.application_id is null then
    raise exception 'Converted outcome requires a linked application';
  end if;
  if v_outcome='follow_up' and (p_follow_up_at is null or p_follow_up_at<=now()) then
    raise exception 'Follow-up time must be in the future';
  end if;

  v_next:=case
    when v_outcome='follow_up' then p_follow_up_at
    when v_outcome='failed' and v_candidate.contact_attempts+1<5
      then now()+make_interval(hours=>least(72,greatest(2,(v_candidate.contact_attempts+1)*6)))
    else null
  end;

  update public.luxe_supply_candidates
  set contact_attempts=contact_attempts+1,
      last_contact_at=case when v_outcome<>'failed' then now() else last_contact_at end,
      outreach_status=case
        when v_outcome='failed' and contact_attempts+1<5 then 'queued'
        when v_outcome='failed' then 'invalid'
        else v_outcome
      end,
      pipeline_stage=case
        when v_outcome in ('contacted','follow_up','responded') then 'contacted'
        when v_outcome='converted' then 'applied'
        when v_outcome in ('unsubscribed','invalid') then 'do_not_contact'
        when v_outcome='failed' and contact_attempts+1>=5 then 'do_not_contact'
        else pipeline_stage
      end,
      next_action_at=v_next,
      outreach_last_error=case when v_outcome='failed' then left(coalesce(p_notes,'Outreach attempt failed'),1000) else null end,
      outreach_last_channel=v_channel,
      rejection_reason=case
        when v_outcome='unsubscribed' then 'Candidate opted out of recruiting outreach'
        when v_outcome='invalid' then 'Candidate contact information is invalid'
        when v_outcome='failed' and contact_attempts+1>=5 then 'Maximum outreach attempts reached'
        else rejection_reason
      end,
      outreach_locked_at=null,
      outreach_locked_by=null,
      updated_at=now()
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.luxe_outreach_events(
    candidate_id,event_type,channel,worker_id,provider_message_id,notes,metadata
  ) values (
    v_candidate.id,v_outcome,v_channel,v_worker,nullif(trim(p_provider_message_id),''),
    nullif(trim(p_notes),''),
    jsonb_build_object(
      'pipeline_stage',v_candidate.pipeline_stage,
      'outreach_status',v_candidate.outreach_status,
      'contact_attempts',v_candidate.contact_attempts,
      'next_action_at',v_candidate.next_action_at
    )
  );

  return jsonb_build_object(
    'candidate_id',v_candidate.id,
    'pipeline_stage',v_candidate.pipeline_stage,
    'outreach_status',v_candidate.outreach_status,
    'contact_attempts',v_candidate.contact_attempts,
    'next_action_at',v_candidate.next_action_at,
    'locked',false
  );
end;
$function$;

create or replace function public.luxe_release_stale_outreach_locks(
  p_stale_minutes integer default 30
)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_count integer;
begin
  if auth.role()<>'service_role' and current_user<>'postgres' then
    raise exception 'Service role required' using errcode='42501';
  end if;

  with stale as (
    select id,outreach_locked_by
    from public.luxe_supply_candidates
    where outreach_locked_at<now()-make_interval(mins=>greatest(10,p_stale_minutes))
    for update skip locked
  ), logged as (
    insert into public.luxe_outreach_events(candidate_id,event_type,channel,worker_id,notes)
    select id,'lock_released','system',outreach_locked_by,'Stale outreach lock released'
    from stale
    returning candidate_id
  ), released as (
    update public.luxe_supply_candidates c
    set outreach_locked_at=null,
        outreach_locked_by=null,
        outreach_last_error='Stale outreach lock released',
        next_action_at=least(coalesce(next_action_at,now()),now()),
        updated_at=now()
    where c.id in (select candidate_id from logged)
    returning c.id
  )
  select count(*) into v_count from released;

  return coalesce(v_count,0);
end;
$function$;

create or replace function public.luxe_link_candidate_application()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_candidate_id uuid;
  v_phone text:=regexp_replace(coalesce(new.phone,''),'[^0-9]','','g');
begin
  select c.id into v_candidate_id
  from public.luxe_supply_candidates c
  where c.application_id is null
    and c.pipeline_stage not in ('activated','rejected','do_not_contact')
    and (
      lower(trim(coalesce(c.email,'')))=lower(trim(new.email))
      or (
        length(v_phone)>=10
        and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')=v_phone
      )
    )
  order by
    case when lower(trim(coalesce(c.email,'')))=lower(trim(new.email)) then 0 else 1 end,
    c.priority_score desc,c.created_at
  limit 1
  for update;

  if v_candidate_id is null then return new; end if;

  update public.luxe_supply_candidates
  set application_id=new.id,
      pipeline_stage='applied',
      outreach_status='converted',
      next_action_at=null,
      outreach_locked_at=null,
      outreach_locked_by=null,
      updated_at=now()
  where id=v_candidate_id;

  insert into public.luxe_candidate_service_matches(
    candidate_id,service_id,match_method,confidence,approved_for_activation
  )
  select v_candidate_id,s.id,'application_selected',1.0,false
  from public.cs_subcategories s
  where s.is_active and s.id=any(new.services_requested)
  on conflict(candidate_id,service_id) do update set
    match_method='application_selected',confidence=1.0;

  update public.luxe_candidate_verification_checks
  set status='submitted',
      evidence_urls=case
        when nullif(trim(new.portfolio_url),'') is null then evidence_urls
        else array[new.portfolio_url]
      end,
      notes='Portfolio submitted with provider application',
      updated_at=now()
  where candidate_id=v_candidate_id
    and check_type='portfolio'
    and nullif(trim(new.portfolio_url),'') is not null
    and status in ('pending','expired');

  insert into public.luxe_outreach_events(
    candidate_id,event_type,channel,worker_id,notes,metadata
  ) values (
    v_candidate_id,'application_linked','system','luxe-application-linker',
    'Provider application linked to recruiting candidate',
    jsonb_build_object(
      'application_id',new.id,
      'application_number',new.application_number,
      'services_requested',new.services_requested,
      'application_status',new.status
    )
  );

  return new;
end;
$function$;

drop trigger if exists luxe_link_candidate_application_trigger on public.luxe_provider_applications;
create trigger luxe_link_candidate_application_trigger
after insert on public.luxe_provider_applications
for each row execute function public.luxe_link_candidate_application();

create or replace view public.luxe_outreach_queue_health
with (security_invoker=true)
as
select
  mapped_category_id,
  count(*) filter(where pipeline_stage='qualified' and outreach_status='queued')::integer queued,
  count(*) filter(where pipeline_stage in ('qualified','contacted') and outreach_status in ('queued','follow_up') and coalesce(next_action_at,now())<=now() and contact_attempts<5)::integer due_now,
  count(*) filter(where outreach_status='follow_up' and next_action_at>now())::integer follow_up_scheduled,
  count(*) filter(where outreach_locked_at is not null)::integer locked,
  count(*) filter(where contact_attempts>=5 and outreach_status not in ('converted','unsubscribed','invalid'))::integer exhausted,
  count(*) filter(where outreach_status='contacted')::integer contacted,
  count(*) filter(where outreach_status='responded')::integer responded,
  count(*) filter(where outreach_status='converted')::integer converted,
  count(*) filter(where outreach_status='unsubscribed')::integer unsubscribed,
  count(*) filter(where outreach_status='invalid')::integer invalid,
  min(next_action_at) filter(where outreach_status in ('queued','follow_up') and contact_attempts<5) next_action_at
from public.luxe_supply_candidates
group by mapped_category_id;

revoke all on public.luxe_outreach_queue_health from public,anon,authenticated;
revoke all on function public.luxe_claim_due_outreach_candidate(text) from public,anon,authenticated;
revoke all on function public.luxe_complete_outreach_candidate(uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.luxe_release_stale_outreach_locks(integer) from public,anon,authenticated;
revoke all on function public.luxe_link_candidate_application() from public,anon,authenticated;
grant execute on function public.luxe_claim_due_outreach_candidate(text) to service_role;
grant execute on function public.luxe_complete_outreach_candidate(uuid,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.luxe_release_stale_outreach_locks(integer) to service_role;

do $block$
begin
  if exists(select 1 from pg_extension where extname='pg_cron')
     and not exists(select 1 from cron.job where jobname='luxe-release-stale-outreach-locks') then
    perform cron.schedule(
      'luxe-release-stale-outreach-locks',
      '*/15 * * * *',
      $cmd$select public.luxe_release_stale_outreach_locks(30);$cmd$
    );
  end if;
end
$block$;
