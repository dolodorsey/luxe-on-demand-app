insert into lm_driver_applications(id,auth_id,full_name,city,state_code,vehicle_class_id,vehicle_make,vehicle_model,vehicle_year,vehicle_color,vehicle_plate) values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Synthetic QA','QA City','GA','qa-class','QA Make','QA Model',2025,'QA Color','QA-ONLY');
update lm_driver_applications set driver_license_status='pending',insurance_status='verified',background_status='verified',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS driver_license_status pending rejects without partial writes';
update lm_driver_applications set driver_license_status='rejected',insurance_status='verified',background_status='verified',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS driver_license_status rejected rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='pending',background_status='verified',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS insurance_status pending rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='rejected',background_status='verified',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS insurance_status rejected rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='verified',background_status='pending',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS background_status pending rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='verified',background_status='rejected',vehicle_status='verified';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS background_status rejected rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='verified',background_status='verified',vehicle_status='pending';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS vehicle_status pending rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='verified',background_status='verified',vehicle_status='rejected';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm <> 'All driver, insurance, background, and vehicle checks must be verified before approval' then raise; end if; end;
 if exists(select 1 from lm_profiles) or exists(select 1 from lm_drivers) or exists(select 1 from lm_driver_applications where application_status<>'submitted' or reviewed_at is not null) then raise exception 'partial write'; end if;
end $$;
select 'PASS vehicle_status rejected rejects without partial writes';
update lm_driver_applications set driver_license_status='verified',insurance_status='verified',background_status='verified',vehicle_status='verified';
do $$ declare d lm_drivers; begin
 d:=lm_approve_driver_application('00000000-0000-4000-8000-000000000001','  QA approved  ');
 if d.approval_status<>'approved' or d.on_duty or d.payouts_enabled or d.vehicle_class_id<>'qa-class' then raise exception 'driver state'; end if;
 if not exists(select 1 from lm_profiles where id=d.profile_id and role='driver' and status='active') then raise exception 'profile state'; end if;
 if not exists(select 1 from lm_driver_applications where application_status='approved' and review_note='QA approved' and reviewed_at is not null and reviewed_by=auth.uid()) then raise exception 'review receipt'; end if;
end $$;
select 'PASS fully verified approval creates correct profile driver and review receipt';
do $$ declare before_id uuid; d lm_drivers; begin
 select id into before_id from lm_drivers;
 d:=lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA repeat');
 if d.id<>before_id or (select count(*) from lm_profiles)<>1 or (select count(*) from lm_drivers)<>1 then raise exception 'duplicate'; end if;
end $$;
select 'PASS repeated approval reuses existing profile and driver';
update lm_driver_applications set application_status='rejected';
do $$ declare before_state jsonb; after_state jsonb; begin
 select to_jsonb(d) into before_state from lm_drivers d;
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Rejected application must be returned to review before approval' then raise; end if; end;
 select to_jsonb(d) into after_state from lm_drivers d;
 if before_state<>after_state or not exists(select 1 from lm_driver_applications where application_status='rejected' and review_note='QA repeat') then raise exception 'partial mutation'; end if;
end $$;
select 'PASS rejected application cannot be approved';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000099','QA'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Driver application not found' then raise; end if; end;
end $$;
select 'PASS missing application rejected';

update lm_driver_applications set application_status='withdrawn';
do $$ declare b jsonb; after_state jsonb; begin
select jsonb_build_object('a',(select jsonb_agg(a) from lm_driver_applications a),'p',(select jsonb_agg(p) from lm_profiles p),'d',(select jsonb_agg(d) from lm_drivers d)) into b;
begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not save'); raise exception 'unexpected acceptance'; exception when raise_exception then if sqlerrm<>'Withdrawn application must be returned to review before approval' then raise; end if; end;
select jsonb_build_object('a',(select jsonb_agg(a) from lm_driver_applications a),'p',(select jsonb_agg(p) from lm_profiles p),'d',(select jsonb_agg(d) from lm_drivers d)) into after_state;
if b<>after_state then raise exception 'partial mutation'; end if;
end $$;
select 'PASS withdrawn approval rejected with all three tables unchanged';
do $$ declare a lm_driver_applications; begin
a:=lm_review_driver_application('00000000-0000-4000-8000-000000000001','verified','verified','verified','verified','under_review','explicit review');
if a.application_status<>'under_review' or a.review_note<>'explicit review' then raise exception 'review path failed'; end if;
end $$;
select 'PASS actual review RPC explicitly returns withdrawn application to review';
do $$ declare d lm_drivers; begin
d:=lm_approve_driver_application('00000000-0000-4000-8000-000000000001','after review');
if d.approval_status<>'approved' or d.on_duty or d.payouts_enabled then raise exception 'approval after review failed'; end if;
end $$;
select 'PASS approval after explicit review succeeds off duty and payouts disabled';
