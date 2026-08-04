-- Controlled recruiting wave only. No candidate is approved or activated.

with ranked as (
  select c.id,c.mapped_category_id,
         row_number() over(
           partition by c.mapped_category_id
           order by c.priority_score desc,c.source_review_count desc nulls last,c.id
         ) rn
  from public.luxe_supply_candidates c
  where lower(coalesce(c.city,''))='atlanta'
    and c.mapped_category_id is not null
), first_wave as (
  select id from ranked where rn<=10
), sequenced as (
  select c.id,row_number() over(order by c.priority_score desc,c.id) seq
  from public.luxe_supply_candidates c
  join first_wave f on f.id=c.id
)
update public.luxe_supply_candidates c
set pipeline_stage='qualified',
    outreach_status='queued',
    assigned_recruiter='luxe-supply-activation-agent',
    next_action_at=now()+(s.seq-1)*interval '10 minutes',
    updated_at=now()
from sequenced s
where c.id=s.id and c.pipeline_stage='prospect';

create or replace view public.luxe_first_wave_summary
with (security_invoker=true)
as
select mapped_category_id,
       count(*)::integer candidates,
       count(*) filter(where outreach_status='queued')::integer queued,
       round(avg(priority_score),2) average_priority,
       min(next_action_at) next_action_at
from public.luxe_supply_candidates
where pipeline_stage='qualified'
  and lower(coalesce(city,''))='atlanta'
group by mapped_category_id;

revoke all on public.luxe_first_wave_summary from public,anon,authenticated;
