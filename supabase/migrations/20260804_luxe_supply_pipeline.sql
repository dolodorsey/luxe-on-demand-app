-- LUXE supply pipeline.
-- Sourced records remain recruiting candidates. They cannot be approved or activated
-- until human-reviewed service mappings and every required verification check pass.

create table if not exists public.luxe_supply_candidates (
  id uuid primary key default gen_random_uuid(),
  source_provider_id uuid not null unique references public.lod_provider_marketplace(id) on delete restrict,
  business_name text not null,
  primary_category text,
  mapped_category_id text references public.cs_categories(id) on delete set null,
  source_subcategories text[] not null default '{}',
  city text,
  phone text,
  email text,
  website text,
  instagram text,
  source_rating numeric,
  source_review_count integer,
  source_platform text,
  pipeline_stage text not null default 'prospect' check (pipeline_stage in (
    'prospect','qualified','contacted','applied','documents_pending','verification',
    'interview','trial','approved_pending_account','activated','rejected','do_not_contact'
  )),
  priority_score numeric not null default 0,
  assigned_recruiter text,
  outreach_status text not null default 'not_started' check (outreach_status in (
    'not_started','queued','contacted','responded','follow_up','converted','unsubscribed','invalid'
  )),
  contact_attempts integer not null default 0,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  application_id uuid references public.luxe_provider_applications(id) on delete set null,
  stylist_id uuid references public.cs_stylists(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luxe_candidate_service_matches (
  candidate_id uuid not null references public.luxe_supply_candidates(id) on delete cascade,
  service_id text not null references public.cs_subcategories(id) on delete cascade,
  match_method text not null check (match_method in ('exact_specialty','category_inference','manual','application_selected')),
  confidence numeric not null check (confidence between 0 and 1),
  approved_for_activation boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(candidate_id,service_id)
);

create table if not exists public.luxe_candidate_verification_checks (
  candidate_id uuid not null references public.luxe_supply_candidates(id) on delete cascade,
  check_type text not null check (check_type in (
    'identity','license','background','insurance','portfolio','interview','trial_service','payout_account'
  )),
  required boolean not null default true,
  status text not null default 'pending' check (status in (
    'pending','submitted','under_review','passed','failed','waived','expired'
  )),
  evidence_urls text[] not null default '{}',
  expires_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(candidate_id,check_type)
);

create table if not exists public.luxe_city_supply_targets (
  city text not null,
  category_id text not null references public.cs_categories(id) on delete cascade,
  target_activated_stylists integer not null default 5 check (target_activated_stylists>=1),
  minimum_on_duty integer not null default 1 check (minimum_on_duty>=0),
  launch_priority smallint not null default 5 check (launch_priority between 1 and 10),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(city,category_id)
);

alter table public.luxe_supply_candidates enable row level security;
alter table public.luxe_candidate_service_matches enable row level security;
alter table public.luxe_candidate_verification_checks enable row level security;
alter table public.luxe_city_supply_targets enable row level security;
revoke all on public.luxe_supply_candidates,public.luxe_candidate_service_matches,
  public.luxe_candidate_verification_checks,public.luxe_city_supply_targets from anon,authenticated;

with scoped as (
  select p.*,
    case
      when lower(p.primary_category) like '%lash%' then 'lashes'
      when lower(p.primary_category) like '%brow%' then 'brows'
      when lower(p.primary_category) like '%nail%' or lower(p.primary_category) like '%manicure%' or lower(p.primary_category) like '%pedicure%' then 'nails'
      when lower(p.primary_category) like '%makeup%' or lower(p.primary_category) like '%make-up%' then 'makeup'
      when lower(p.primary_category) like '%wax%' then 'waxing'
      when lower(p.primary_category) like '%spray tan%' or lower(p.primary_category) like '%body contour%' then 'spray_tan'
      when lower(p.primary_category) like '%skin%' or lower(p.primary_category) like '%facial%' or lower(p.primary_category) like '%esthetic%' then 'skincare'
      when lower(p.primary_category) like '%barber%' or lower(p.primary_category) like '%groom%' then 'mens_grooming'
      when lower(p.primary_category) like '%bridal%' or lower(p.primary_category) like '%wedding%' then 'bridal_events'
      when lower(p.primary_category) like '%kid%' or lower(p.primary_category) like '%teen%' then 'kids_teens'
      when lower(p.primary_category) like '%concierge%' or lower(p.primary_category) like '%wardrobe%' or lower(p.primary_category) like '%personal shopper%' then 'beauty_concierge'
      when lower(p.primary_category) like '%inject%' or lower(p.primary_category) like '%botox%' or lower(p.primary_category) like '%filler%' or lower(p.primary_category) like '%aesthetic%' then 'aesthetics_consult'
      when lower(p.primary_category) like '%hair%' or lower(p.primary_category) like '%braid%' or lower(p.primary_category) like '%wig%' or lower(p.primary_category) like '%loc%' then 'hair'
    end as mapped_category_id
  from public.lod_provider_marketplace p
  where nullif(p.primary_category,'') is not null
)
insert into public.luxe_supply_candidates(
  source_provider_id,business_name,primary_category,mapped_category_id,source_subcategories,
  city,phone,email,website,instagram,source_rating,source_review_count,source_platform,priority_score
)
select p.id,p.business_name,p.primary_category,p.mapped_category_id,coalesce(p.subcategories,'{}'),
       p.city,p.phone,p.email,p.website,p.instagram,
       coalesce(p.google_rating,p.rating),coalesce(p.google_review_count,p.review_count),p.source_platform,
       round((
         case when lower(coalesce(p.city,''))='atlanta' then 25 else 10 end +
         case when nullif(p.phone,'') is not null then 15 else 0 end +
         case when nullif(p.email,'') is not null then 15 else 0 end +
         case when nullif(p.instagram,'') is not null then 10 else 0 end +
         least(coalesce(p.google_review_count,p.review_count,0),250)::numeric/10 +
         coalesce(p.google_rating,p.rating,0)*5
       )::numeric,2)
from scoped p
where p.mapped_category_id is not null
  and (nullif(p.phone,'') is not null or nullif(p.email,'') is not null or nullif(p.instagram,'') is not null)
order by case when lower(coalesce(p.city,''))='atlanta' then 0 else 1 end,
         coalesce(p.google_review_count,p.review_count,0) desc,
         coalesce(p.google_rating,p.rating,0) desc
limit 3000
on conflict(source_provider_id) do update set
  business_name=excluded.business_name,
  primary_category=excluded.primary_category,
  mapped_category_id=excluded.mapped_category_id,
  source_subcategories=excluded.source_subcategories,
  city=excluded.city,
  phone=excluded.phone,
  email=excluded.email,
  website=excluded.website,
  instagram=excluded.instagram,
  source_rating=excluded.source_rating,
  source_review_count=excluded.source_review_count,
  source_platform=excluded.source_platform,
  priority_score=excluded.priority_score,
  updated_at=now();

insert into public.luxe_candidate_service_matches(candidate_id,service_id,match_method,confidence)
select c.id,s.id,'exact_specialty',0.95
from public.luxe_supply_candidates c
join public.cs_subcategories s on s.is_active
where lower(regexp_replace(c.primary_category,'[^a-z0-9]+','','g'))=
      lower(regexp_replace(s.name,'[^a-z0-9]+','','g'))
on conflict(candidate_id,service_id) do update set
  match_method=excluded.match_method,
  confidence=greatest(public.luxe_candidate_service_matches.confidence,excluded.confidence);

insert into public.luxe_candidate_service_matches(candidate_id,service_id,match_method,confidence)
select c.id,s.id,'category_inference',0.60
from public.luxe_supply_candidates c
join public.cs_subcategories s on s.category_id=c.mapped_category_id and s.is_active
on conflict(candidate_id,service_id) do nothing;

insert into public.luxe_candidate_verification_checks(candidate_id,check_type,required)
select c.id,x.check_type,true
from public.luxe_supply_candidates c
cross join (values
  ('identity'),('background'),('insurance'),('portfolio'),('interview'),('trial_service'),('payout_account')
) x(check_type)
on conflict(candidate_id,check_type) do nothing;

insert into public.luxe_candidate_verification_checks(candidate_id,check_type,required)
select distinct m.candidate_id,'license',true
from public.luxe_candidate_service_matches m
join public.cs_subcategories s on s.id=m.service_id
where coalesce(s.regulated,false)=true or nullif(s.provider_credential_required,'') is not null
on conflict(candidate_id,check_type) do update set required=true,updated_at=now();

insert into public.luxe_city_supply_targets(city,category_id,target_activated_stylists,minimum_on_duty,launch_priority)
select city,cat.id,
       case when city='Atlanta' then 12 else 5 end,
       case when city='Atlanta' then 3 else 1 end,
       case when city='Atlanta' then 10 else 6 end
from (values
  ('Atlanta'),('Houston'),('Dallas'),('Miami'),('Charlotte'),
  ('Washington DC'),('New York'),('Los Angeles'),('Phoenix'),('Las Vegas')
) c(city)
cross join public.cs_categories cat
where cat.is_active
on conflict(city,category_id) do update set
  target_activated_stylists=excluded.target_activated_stylists,
  minimum_on_duty=excluded.minimum_on_duty,
  launch_priority=excluded.launch_priority,
  is_active=true,
  updated_at=now();

drop view if exists public.luxe_supply_readiness;
create view public.luxe_supply_readiness
with (security_invoker=true)
as
with service_counts as (
  select candidate_id,
         count(*)::integer as matched_services,
         count(*) filter (where approved_for_activation)::integer as approved_services
  from public.luxe_candidate_service_matches
  group by candidate_id
), check_counts as (
  select candidate_id,
         count(*) filter (where required)::integer as required_checks,
         count(*) filter (where required and status='passed')::integer as passed_checks,
         coalesce(bool_and(case when required then status='passed' else true end),false) as verification_complete
  from public.luxe_candidate_verification_checks
  group by candidate_id
)
select c.id,c.business_name,c.city,c.primary_category,c.mapped_category_id,c.pipeline_stage,
       c.priority_score,c.outreach_status,
       coalesce(s.matched_services,0) as matched_services,
       coalesce(s.approved_services,0) as approved_services,
       coalesce(v.required_checks,0) as required_checks,
       coalesce(v.passed_checks,0) as passed_checks,
       coalesce(v.verification_complete,false) as verification_complete,
       c.application_id,c.stylist_id,c.next_action_at
from public.luxe_supply_candidates c
left join service_counts s on s.candidate_id=c.id
left join check_counts v on v.candidate_id=c.id;
revoke all on public.luxe_supply_readiness from anon,authenticated;

create or replace function public.luxe_mark_candidate_approved(p_candidate_id uuid)
returns public.luxe_supply_candidates
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare v_candidate public.luxe_supply_candidates%rowtype;
begin
  if auth.role()<>'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if exists(
    select 1 from public.luxe_candidate_verification_checks
    where candidate_id=p_candidate_id and required and status<>'passed'
  ) then
    raise exception 'All required verification checks must pass';
  end if;
  if not exists(
    select 1 from public.luxe_candidate_service_matches where candidate_id=p_candidate_id
  ) then
    raise exception 'At least one service match is required';
  end if;

  update public.luxe_candidate_service_matches
  set approved_for_activation=true,reviewed_at=now()
  where candidate_id=p_candidate_id;

  update public.luxe_supply_candidates
  set pipeline_stage='approved_pending_account',updated_at=now()
  where id=p_candidate_id
  returning * into v_candidate;

  if not found then raise exception 'Candidate not found'; end if;
  return v_candidate;
end;$$;

revoke all on function public.luxe_mark_candidate_approved(uuid) from public;
grant execute on function public.luxe_mark_candidate_approved(uuid) to service_role;

create index if not exists luxe_supply_stage_priority_idx
  on public.luxe_supply_candidates(pipeline_stage,priority_score desc);
create index if not exists luxe_supply_city_category_idx
  on public.luxe_supply_candidates(city,primary_category);
create index if not exists luxe_supply_mapped_category_idx
  on public.luxe_supply_candidates(mapped_category_id,city,pipeline_stage);
create index if not exists luxe_candidate_checks_status_idx
  on public.luxe_candidate_verification_checks(status,check_type);
create index if not exists luxe_candidate_matches_service_idx
  on public.luxe_candidate_service_matches(service_id,approved_for_activation);
