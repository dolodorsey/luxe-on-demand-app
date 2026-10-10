import json, os, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).parent
BIN=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
results=[]
with tempfile.TemporaryDirectory(prefix='luxe-withdrawn-',dir='/tmp') as scratch:
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 env.update(PGHOST=scratch,PGPORT='55449',PGDATABASE='postgres')
 def run(name,args=[],data=None):
  r=subprocess.run([str(BIN/name),*args],input=data,env=env,text=True,capture_output=True,timeout=30)
  if r.returncode: raise RuntimeError(r.stderr)
  return r
 def sql(s): return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s).stdout.strip()
 started=False
 try:
  run('initdb',['-D',scratch+'/data','-A','trust','--no-locale'])
  run('pg_ctl',['-D',scratch+'/data','-l',scratch+'/log','-o',f"-c listen_addresses='' -k {scratch} -p 55449",'start']); started=True
  sql((ROOT/'fixture.sql').read_text())
  sql((ROOT.parent.parent/'supabase/migrations/20261010184500_luxe_withdrawn_approval_guard.sql').read_text())
  result=sql((ROOT/'checks.sql').read_text())
  results=[line for line in result.splitlines() if line.startswith('PASS ')]
  assert len(results)==15, results
 finally:
  if started: run('pg_ctl',['-D',scratch+'/data','-m','fast','stop'])
out={'postgres':run('postgres',['--version']).stdout.strip(),'checks':results,'passed':len(results),'local_only':True,'operator_stub':True,'cluster_removed':True}

print(json.dumps(out,indent=2))
