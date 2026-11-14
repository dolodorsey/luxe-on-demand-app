import json, os, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).parent
REPO=ROOT.parent.parent
BIN=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
results=[]
with tempfile.TemporaryDirectory(prefix='luxe-approval-lifecycle-',dir='/tmp') as scratch:
 env.update(PGHOST=scratch,PGPORT='55451',PGDATABASE='postgres')
 def run(name,args=[],data=None):
  r=subprocess.run([str(BIN/name),*args],input=data,env=env,text=True,capture_output=True,timeout=30)
  if r.returncode: raise RuntimeError(r.stderr)
  return r
 def sql(s): return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s).stdout.strip()
 started=False
 try:
  run('initdb',['-D',scratch+'/data','-A','trust','--no-locale'])
  run('pg_ctl',['-D',scratch+'/data','-l',scratch+'/log','-o',f"-c listen_addresses='' -k {scratch} -p 55451",'start']); started=True
  sql((REPO/'tests/withdrawal-guard/fixture.sql').read_text())
  sql((REPO/'supabase/migrations/20261010184500_luxe_withdrawn_approval_guard.sql').read_text())
  acl_before=sql("select coalesce(proacl::text,'') from pg_proc where oid='public.lm_approve_driver_application(uuid,text)'::regprocedure")
  sql((REPO/'supabase/migrations/20261114014000_luxe_driver_approval_lifecycle_guard.sql').read_text())
  acl_after=sql("select coalesce(proacl::text,'') from pg_proc where oid='public.lm_approve_driver_application(uuid,text)'::regprocedure")
  assert acl_before==acl_after,(acl_before,acl_after)
  results=[line for line in sql((ROOT/'checks.sql').read_text()).splitlines() if line.startswith('PASS ')]
  results.append('PASS approval RPC privileges unchanged by CREATE OR REPLACE')
  assert len(results)==8,results
 finally:
  if started: run('pg_ctl',['-D',scratch+'/data','-m','fast','stop'])
out={'postgres':run('postgres',['--version']).stdout.strip(),'checks':results,'passed':len(results),'local_only':True,'operator_stub':True,'cluster_removed':True}
print(json.dumps(out,indent=2))
