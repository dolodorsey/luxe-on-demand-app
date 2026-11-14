-- Every test runs inside the caller's transaction; check.py rolls all changes back.
insert into lm_driver_applications(id,auth_id,full_name,city,state_code,vehicle_class_id,vehicle_make,vehicle_model,vehicle_year,vehicle_color,vehicle_plate,driver_license_status,insurance_status,background_status,vehicle_status)
values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Synthetic QA','QA City','GA','qa-class','QA Make','QA Model',2025,'QA Color','QA-ONLY','verified','verified','verified','verified');

-- Existing rider profiles may complete driver onboarding; admin accounts may not be converted.
insert into lm_profiles(id,auth_id,role,full_name,phone,status) values('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000002','rider','Existing rider','old phone','active');
do $$ declare d lm_drivers; begin
 d:=lm_approve_driver_application('00000000-0000-4000-8000-000000000001','Initial approval');
 if d.approval_status<>'approved' or d.on_duty or d.payouts_enabled then raise exception 'unsafe initial state'; end if;
 if not exists(select 1 from lm_profiles where auth_id='00000000-0000-4000-8000-000000000002' and role='driver' and status='active' and full_name='Existing rider') then raise exception 'profile conversion'; end if;
end $$;
select 'PASS active rider converts once with safe driver defaults and preserves profile details';

-- A repeated approval is a no-op, preserving all operational values and timestamps.
update lm_drivers set on_duty=true,payouts_enabled=true,vehicle_make='Operator Make',vehicle_plate='OP-1',updated_at='2026-01-01T00:00:00Z';
update lm_profiles set full_name='Operator Name',phone='Operator Phone',updated_at='2026-01-01T00:00:00Z';
update lm_driver_applications set review_note='Original note',reviewed_at='2026-01-01T00:00:00Z';
do $$ declare before_state jsonb; after_state jsonb; d lm_drivers; begin
 select jsonb_build_object('a',(select to_jsonb(aa) from lm_driver_applications aa),'p',(select to_jsonb(pp) from lm_profiles pp),'d',(select to_jsonb(dd) from lm_drivers dd)) into before_state;
 d:=lm_approve_driver_application('00000000-0000-4000-8000-000000000001','Overwrite attempt');
 select jsonb_build_object('a',(select to_jsonb(aa) from lm_driver_applications aa),'p',(select to_jsonb(pp) from lm_profiles pp),'d',(select to_jsonb(dd) from lm_drivers dd)) into after_state;
 if before_state<>after_state or d.on_duty is not true or d.payouts_enabled is not true or d.vehicle_make<>'Operator Make' then raise exception 'repeat approval mutated state'; end if;
end $$;
select 'PASS repeated approval is a full no-op for application, profile, and driver';

-- Suspended account lifecycle cannot be restored by approval.
update lm_profiles set status='suspended'; update lm_drivers set approval_status='suspended';
do $$ declare before_state jsonb; after_state jsonb; begin
 select jsonb_build_object('a',(select to_jsonb(aa) from lm_driver_applications aa),'p',(select to_jsonb(pp) from lm_profiles pp),'d',(select to_jsonb(dd) from lm_drivers dd)) into before_state;
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not reactivate'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Existing account is not active; separate reinstatement review is required' then raise; end if; end;
 select jsonb_build_object('a',(select to_jsonb(aa) from lm_driver_applications aa),'p',(select to_jsonb(pp) from lm_profiles pp),'d',(select to_jsonb(dd) from lm_drivers dd)) into after_state;
 if before_state<>after_state then raise exception 'suspension changed'; end if;
end $$;
select 'PASS suspended account approval rejected without partial writes';

-- An admin or closed identity is never converted into a public driver.
delete from lm_profiles; delete from lm_drivers; update lm_driver_applications set application_status='under_review';
insert into lm_profiles(auth_id,role,full_name,status) values('00000000-0000-4000-8000-000000000002','admin','Synthetic admin','active');
do $$ declare b jsonb; a jsonb; begin
 select jsonb_build_object('a',(select to_jsonb(x) from lm_driver_applications x),'p',(select to_jsonb(x) from lm_profiles x),'d',(select jsonb_agg(to_jsonb(x)) from lm_drivers x)) into b;
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not convert admin'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Existing account role requires separate review before driver approval' then raise; end if; end;
 select jsonb_build_object('a',(select to_jsonb(x) from lm_driver_applications x),'p',(select to_jsonb(x) from lm_profiles x),'d',(select jsonb_agg(to_jsonb(x)) from lm_drivers x)) into a;
 if b<>a then raise exception 'admin conversion partially wrote'; end if;
end $$;
select 'PASS admin account approval rejected without conversion';

update lm_profiles set role='rider',status='closed';
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not reopen'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Existing account is not active; separate reinstatement review is required' then raise; end if; end;
 if not exists(select 1 from lm_profiles where role='rider' and status='closed') or exists(select 1 from lm_drivers) then raise exception 'closed profile changed'; end if;
end $$;
select 'PASS closed account approval rejected without profile or driver changes';

-- An active driver profile is not enough to reinstate a suspended driver record.
delete from lm_profiles; delete from lm_drivers; update lm_driver_applications set application_status='under_review';
insert into lm_profiles(auth_id,role,full_name,status) values('00000000-0000-4000-8000-000000000002','driver','Synthetic driver','active');
insert into lm_drivers(profile_id,approval_status,on_duty,vehicle_class_id,vehicle_make,vehicle_model,vehicle_color,vehicle_plate,payouts_enabled)
select id,'suspended',false,'qa-class','Existing','Vehicle','Blue','EX-1',false from lm_profiles;
do $$ declare b jsonb; a jsonb; begin
 select jsonb_build_object('app',(select to_jsonb(x) from lm_driver_applications x),'profile',(select to_jsonb(x) from lm_profiles x),'driver',(select to_jsonb(x) from lm_drivers x)) into b;
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not reinstate'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Existing driver requires separate reinstatement review before approval' then raise; end if; end;
 select jsonb_build_object('app',(select to_jsonb(x) from lm_driver_applications x),'profile',(select to_jsonb(x) from lm_profiles x),'driver',(select to_jsonb(x) from lm_drivers x)) into a;
 if b<>a then raise exception 'suspended driver changed'; end if;
end $$;
select 'PASS suspended driver approval rejected without partial writes';

-- An already-approved application missing its operational record is not silently repaired.
delete from lm_profiles; delete from lm_drivers; update lm_driver_applications set application_status='approved';
insert into lm_profiles(auth_id,role,full_name,status) values('00000000-0000-4000-8000-000000000002','driver','Synthetic driver','active');
do $$ begin
 begin perform lm_approve_driver_application('00000000-0000-4000-8000-000000000001','must not recreate'); raise exception 'unexpected acceptance';
 exception when raise_exception then if sqlerrm<>'Approved application has no driver record; manual reconciliation is required' then raise; end if; end;
 if not exists(select 1 from lm_driver_applications where application_status='approved') or exists(select 1 from lm_drivers) then raise exception 'inconsistent approved state mutated'; end if;
end $$;
select 'PASS inconsistent approved application is held for manual reconciliation';
