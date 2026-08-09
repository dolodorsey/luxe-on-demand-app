'use client'

import { FormEvent, useEffect, useState } from 'react'
import { getMobilitySession, loadVehicleClasses, luxeMobility, type VehicleClass } from '../lib/luxe-mobility'
import '../app/luxe-driver-application.css'

type DriverApplication = {
  id:string
  full_name:string
  email:string|null
  phone:string|null
  city:string
  state_code:string
  vehicle_class_id:string
  vehicle_make:string
  vehicle_model:string
  vehicle_year:number
  vehicle_color:string
  vehicle_plate:string
  application_status:'submitted'|'under_review'|'approved'|'rejected'|'withdrawn'
  driver_license_status:'pending'|'verified'|'rejected'
  insurance_status:'pending'|'verified'|'rejected'
  background_status:'pending'|'verified'|'rejected'
  vehicle_status:'pending'|'verified'|'rejected'
  submitted_at:string
}

const emptyForm={
  fullName:'',email:'',phone:'',city:'Atlanta',stateCode:'GA',vehicleClassId:'luxe_black',
  vehicleMake:'',vehicleModel:'',vehicleYear:new Date().getFullYear(),vehicleColor:'',vehiclePlate:'',note:''
}

export default function LuxeDriverApplication(){
  const [booting,setBooting]=useState(true)
  const [session,setSession]=useState<any>(null)
  const [classes,setClasses]=useState<VehicleClass[]>([])
  const [application,setApplication]=useState<DriverApplication|null>(null)
  const [form,setForm]=useState(emptyForm)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  useEffect(()=>{
    let active=true
    ;(async()=>{
      try{
        const [nextSession,nextClasses]=await Promise.all([getMobilitySession(),loadVehicleClasses()])
        if(!active)return
        setSession(nextSession);setClasses(nextClasses)
        if(nextSession?.user){
          setForm(current=>({...current,email:nextSession.user.email||'',fullName:String(nextSession.user.user_metadata?.full_name||'')}))
          const {data,error}=await luxeMobility.functions.invoke('luxe-driver-application',{body:{action:'status'}})
          if(!error&&data?.application){
            const app=data.application as DriverApplication
            setApplication(app)
            setForm({
              fullName:app.full_name,email:app.email||'',phone:app.phone||'',city:app.city,stateCode:app.state_code,
              vehicleClassId:app.vehicle_class_id,vehicleMake:app.vehicle_make,vehicleModel:app.vehicle_model,vehicleYear:app.vehicle_year,
              vehicleColor:app.vehicle_color,vehiclePlate:app.vehicle_plate,note:''
            })
          }
        }
      }catch(error){setMessage(error instanceof Error?error.message:'Driver application could not load.')}
      finally{if(active)setBooting(false)}
    })()
    return()=>{active=false}
  },[])

  const set=(key:keyof typeof form,value:string|number)=>setForm(current=>({...current,[key]:value}))

  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return
    setBusy(true);setMessage('')
    try{
      const {data,error}=await luxeMobility.functions.invoke('luxe-driver-application',{body:{
        action:'submit',
        fullName:form.fullName,email:form.email,phone:form.phone,city:form.city,stateCode:form.stateCode,
        vehicleClassId:form.vehicleClassId,vehicleMake:form.vehicleMake,vehicleModel:form.vehicleModel,vehicleYear:form.vehicleYear,
        vehicleColor:form.vehicleColor,vehiclePlate:form.vehiclePlate,note:form.note,
      }})
      if(error)throw error
      if(data?.error)throw new Error(data.error)
      setApplication(data.application as DriverApplication)
      setMessage('Application received. LUXE will not activate driving access until every required check and payout setup is verified.')
    }catch(error){setMessage(error instanceof Error?error.message:'Application could not be submitted.')}
    finally{setBusy(false)}
  }

  if(booting)return <main className="lda-loading"><span>LUXE</span><p>Opening driver network</p></main>

  if(!session)return <main className="lda-shell"><section className="lda-gate"><div className="lda-mark">LUXE<small>DRIVER NETWORK</small></div><span>DRIVER APPLICATION</span><h1>Drive the<br/>premium standard.</h1><p>Create or sign into your LUXE account before applying. Driver access is never activated from an application alone.</p><a href="/">Sign in to LUXE</a></section></main>

  const checks=application?[
    ['License',application.driver_license_status],['Insurance',application.insurance_status],
    ['Background',application.background_status],['Vehicle',application.vehicle_status]
  ]:[]

  return <main className="lda-shell">
    <header><div className="lda-mark dark">LUXE<small>DRIVER NETWORK</small></div><a href="/">Rider app</a></header>
    <section className="lda-hero"><div><span>DRIVER APPLICATION</span><h1>Professional drivers.<br/><em>Premium movement.</em></h1><p>Submit your identity and vehicle profile. LUXE operations verifies licensing, insurance, background eligibility and the vehicle before approval.</p></div><aside><b>4</b><small>required verification gates</small></aside></section>

    {application&&<section className="lda-status"><div><span>APPLICATION STATUS</span><h2>{application.application_status.replace('_',' ')}</h2><p>Submitted {new Date(application.submitted_at).toLocaleDateString()}</p></div><div className="lda-checks">{checks.map(([label,status])=><div key={label}><strong>{label}</strong><span className={status}>{status}</span></div>)}</div></section>}

    <form className="lda-form" onSubmit={submit}>
      <div className="lda-section"><span>01</span><div><h2>You</h2><p>Basic contact information tied to your authenticated LUXE account.</p></div></div>
      <div className="lda-grid"><label>Full name<input required minLength={2} value={form.fullName} onChange={e=>set('fullName',e.target.value)}/></label><label>Email<input required type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label><label>Phone<input required value={form.phone} onChange={e=>set('phone',e.target.value)}/></label><label>City<input required value={form.city} onChange={e=>set('city',e.target.value)}/></label><label>State<input required maxLength={2} value={form.stateCode} onChange={e=>set('stateCode',e.target.value.toUpperCase())}/></label></div>

      <div className="lda-section"><span>02</span><div><h2>Your vehicle</h2><p>Choose the LUXE class you intend to operate. Final class eligibility is verified by operations.</p></div></div>
      <div className="lda-grid"><label>LUXE class<select value={form.vehicleClassId} onChange={e=>set('vehicleClassId',e.target.value)}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Make<input required value={form.vehicleMake} onChange={e=>set('vehicleMake',e.target.value)}/></label><label>Model<input required value={form.vehicleModel} onChange={e=>set('vehicleModel',e.target.value)}/></label><label>Year<input required type="number" min={new Date().getFullYear()-20} max={new Date().getFullYear()+1} value={form.vehicleYear} onChange={e=>set('vehicleYear',Number(e.target.value))}/></label><label>Color<input required value={form.vehicleColor} onChange={e=>set('vehicleColor',e.target.value)}/></label><label>Plate<input required value={form.vehiclePlate} onChange={e=>set('vehiclePlate',e.target.value.toUpperCase())}/></label></div>

      <div className="lda-section"><span>03</span><div><h2>Review notes</h2><p>Do not enter license numbers, insurance policy numbers or other sensitive documents here. Operations will request verification through an approved secure process.</p></div></div>
      <label className="lda-wide">Anything operations should know?<textarea rows={4} maxLength={2000} value={form.note} onChange={e=>set('note',e.target.value)}/></label>

      {message&&<div className="lda-message">{message}</div>}
      <button className="lda-submit" disabled={busy||application?.application_status==='approved'}>{busy?'Submitting…':application?.application_status==='approved'?'Driver approved — vehicle changes require operations':application?'Update application':'Submit driver application'}</button>
      <small className="lda-fine">Submitting does not approve or activate a driver. On-duty access remains locked until verification and payout readiness are complete.</small>
    </form>
  </main>
}
