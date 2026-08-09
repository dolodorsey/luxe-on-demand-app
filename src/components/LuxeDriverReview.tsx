'use client'

import { useEffect, useState } from 'react'
import { getMobilitySession, luxeMobility } from '../lib/luxe-mobility'
import '../app/luxe-driver-application.css'
import '../app/luxe-driver-review.css'

type CheckStatus='pending'|'verified'|'rejected'
type Application={
  id:string;full_name:string;email:string|null;phone:string|null;city:string;state_code:string;vehicle_class_id:string;
  vehicle_make:string;vehicle_model:string;vehicle_year:number;vehicle_color:string;vehicle_plate:string;
  driver_license_status:CheckStatus;insurance_status:CheckStatus;background_status:CheckStatus;vehicle_status:CheckStatus;
  application_status:string;review_note:string|null;submitted_at:string
}

export default function LuxeDriverReview(){
  const [loading,setLoading]=useState(true)
  const [apps,setApps]=useState<Application[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState('')

  const load=async()=>{
    const {data,error}=await luxeMobility.rpc('lm_operator_driver_applications',{p_status:null})
    if(error)throw error
    setApps((data||[]) as Application[])
  }

  useEffect(()=>{;(async()=>{
    try{
      const session=await getMobilitySession()
      if(!session){window.location.assign('/');return}
      await load()
    }catch(error){setMessage(error instanceof Error?error.message:'Operator review unavailable')}
    finally{setLoading(false)}
  })()},[])

  const patch=(id:string,key:keyof Application,value:string)=>setApps(current=>current.map(item=>item.id===id?{...item,[key]:value}:item))

  const saveReview=async(app:Application,decision:'under_review'|'rejected')=>{
    setBusy(app.id);setMessage('')
    try{
      const {error}=await luxeMobility.rpc('lm_review_driver_application',{
        p_application_id:app.id,p_driver_license_status:app.driver_license_status,p_insurance_status:app.insurance_status,
        p_background_status:app.background_status,p_vehicle_status:app.vehicle_status,p_decision:decision,p_review_note:app.review_note||null,
      })
      if(error)throw error
      await load();setMessage(decision==='rejected'?'Application rejected.':'Verification review saved.')
    }catch(error){setMessage(error instanceof Error?error.message:'Review update failed')}
    finally{setBusy('')}
  }

  const approve=async(app:Application)=>{
    setBusy(app.id);setMessage('')
    try{
      const {error}=await luxeMobility.rpc('lm_approve_driver_application',{p_application_id:app.id,p_review_note:app.review_note||null})
      if(error)throw error
      await load();setMessage('Driver approved. They remain offline until Stripe payout onboarding is complete and they choose Go online.')
    }catch(error){setMessage(error instanceof Error?error.message:'Driver approval failed')}
    finally{setBusy('')}
  }

  if(loading)return <main className="lda-loading"><span>LUXE</span><p>Opening operator review</p></main>

  return <main className="lda-shell">
    <header><div className="lda-mark dark">LUXE<small>OPERATIONS</small></div><a href="/driver">Driver network</a></header>
    <section className="lda-hero"><div><span>DRIVER VERIFICATION</span><h1>Approve evidence.<br/><em>Never assumptions.</em></h1><p>Every verification control must reflect an actual completed review. Approval cannot make a driver online and cannot bypass payout readiness.</p></div><aside><b>{apps.length}</b><small>applications in the queue</small></aside></section>
    {message&&<div className="lda-form"><div className="lda-message">{message}</div></div>}
    <section className="lda-form">
      {apps.length===0?<div className="lda-message">No driver applications are waiting in the LUXE queue.</div>:apps.map(app=>{
        const verified=[app.driver_license_status,app.insurance_status,app.background_status,app.vehicle_status].every(value=>value==='verified')
        return <article key={app.id} className="lda-review-card">
          <div className="lda-section"><span>◆</span><div><h2>{app.full_name}</h2><p>{app.city}, {app.state_code} · {app.vehicle_year} {app.vehicle_make} {app.vehicle_model} · {app.vehicle_plate} · {app.vehicle_class_id}</p></div></div>
          <div className="lda-grid">
            {([
              ['License','driver_license_status'],['Insurance','insurance_status'],['Background','background_status'],['Vehicle','vehicle_status']
            ] as const).map(([label,key])=><label key={key}>{label}<select value={app[key]} onChange={e=>patch(app.id,key,e.target.value)}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label>)}
          </div>
          <label className="lda-wide">Review note<textarea rows={3} value={app.review_note||''} onChange={e=>patch(app.id,'review_note',e.target.value)}/></label>
          <div className="lda-review-actions"><button type="button" disabled={busy===app.id||app.application_status==='approved'} onClick={()=>saveReview(app,'under_review')}>Save review</button><button type="button" disabled={busy===app.id||app.application_status==='approved'} className="danger" onClick={()=>saveReview(app,'rejected')}>Reject</button><button type="button" disabled={busy===app.id||!verified||app.application_status==='approved'} className="approve" onClick={()=>approve(app)}>{app.application_status==='approved'?'Approved':'Approve driver'}</button></div>
        </article>
      })}
    </section>
  </main>
}
