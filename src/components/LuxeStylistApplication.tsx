'use client'

import React, { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseUrl } from '../lib/supabase'
import type { LuxeService } from '../lib/luxe-marketplace'

const FUNCTION_URL = `${supabaseUrl}/functions/v1/luxe-provider-application`

export default function LuxeStylistApplication() {
  const [services,setServices] = useState<LuxeService[]>([])
  const [query,setQuery] = useState('')
  const [selected,setSelected] = useState<string[]>([])
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [applicationNumber,setApplicationNumber] = useState('')
  const [form,setForm] = useState({
    first_name:'',last_name:'',email:'',phone:'',city:'Atlanta',state_code:'GA',zip_code:'',
    years_experience:'',experience_description:'',has_vehicle:true,vehicle_type:'',portfolio_url:'',background_check_consent:false,
  })

  useEffect(()=>{
    supabase.from('cs_subcategories').select('id,category_id,name,description,base_price,min_price,max_price,duration_minutes,mobile_available,in_studio_available,rush_eligible,regulated,mobile_fee,rush_fee,provider_credential_required,compliance_note,icon_url,sort_order')
      .eq('is_active',true).order('name').then(({data})=>setServices((data||[]) as LuxeService[]))
  },[])

  const filtered=useMemo(()=>services.filter(service=>!query||`${service.name} ${service.category_id}`.toLowerCase().includes(query.toLowerCase())).slice(0,80),[services,query])
  const toggle=(name:string)=>setSelected(current=>current.includes(name)?current.filter(item=>item!==name):current.length<30?[...current,name]:current)

  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setError('')
    try{
      const response=await fetch(FUNCTION_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,years_experience:Number(form.years_experience),services_requested:selected})})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Application could not be submitted.')
      setApplicationNumber(payload.application_number||'Submitted')
    }catch(submissionError){setError(submissionError instanceof Error?submissionError.message:'Application could not be submitted.')}
    finally{setBusy(false)}
  }

  if(applicationNumber)return <div className="lxapply-shell"><div className="lxapply-success"><div className="lxapply-seal">L</div><span>APPLICATION RECEIVED</span><h1>Your craft is in review.</h1><p>Application <strong>{applicationNumber}</strong> was received. LUXE will verify identity, licensing, experience, insurance, and portfolio quality before activating a talent profile.</p><a href="/">Return to LUXE</a></div></div>

  return <div className="lxapply-shell"><header><a href="/" className="lxapply-brand"><span>L</span><div><strong>LUXE</strong><small>TALENT NETWORK</small></div></a><em>Professional application</em></header><main><section className="lxapply-intro"><span>VETTED TALENT ONLY</span><h1>Bring your craft<br/><em>to LUXE.</em></h1><p>LUXE is building a white-glove beauty network for mobile, studio, hotel, bridal, event, and concierge services. Acceptance is not automatic.</p><div className="lxapply-standards"><div><strong>01</strong><span>Identity & background review</span></div><div><strong>02</strong><span>License and credential verification</span></div><div><strong>03</strong><span>Portfolio and service-quality review</span></div><div><strong>04</strong><span>Stripe payout onboarding after approval</span></div></div></section><form onSubmit={submit} className="lxapply-form"><div className="lxapply-section"><span>01 — CONTACT</span><div className="lxapply-grid"><label>First name<input required value={form.first_name} onChange={event=>setForm({...form,first_name:event.target.value})}/></label><label>Last name<input required value={form.last_name} onChange={event=>setForm({...form,last_name:event.target.value})}/></label><label>Email<input required type="email" value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label>Phone<input required value={form.phone} onChange={event=>setForm({...form,phone:event.target.value})}/></label><label>City<input required value={form.city} onChange={event=>setForm({...form,city:event.target.value})}/></label><label>State<input required maxLength={2} value={form.state_code} onChange={event=>setForm({...form,state_code:event.target.value.toUpperCase()})}/></label><label>ZIP<input value={form.zip_code} onChange={event=>setForm({...form,zip_code:event.target.value})}/></label><label>Years experience<input required min={0} max={80} type="number" value={form.years_experience} onChange={event=>setForm({...form,years_experience:event.target.value})}/></label></div></div><div className="lxapply-section"><span>02 — SPECIALTIES</span><p>Select up to 30 services you are professionally qualified to perform.</p><div className="lxapply-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search the 292-service catalog"/><b>{selected.length}/30</b></div><div className="lxapply-services">{filtered.map(service=><button type="button" key={service.id} className={selected.includes(service.name)?'selected':''} onClick={()=>toggle(service.name)}><span>{selected.includes(service.name)?'✓':'+'}</span><div><strong>{service.name}</strong><small>{service.category_id.replaceAll('_',' ')} · {service.mobile_available?'mobile':''}{service.mobile_available&&service.in_studio_available?' / ':''}{service.in_studio_available?'studio':''}</small></div></button>)}</div></div><div className="lxapply-section"><span>03 — EXPERIENCE</span><label>Portfolio or professional profile URL<input type="url" placeholder="https://" value={form.portfolio_url} onChange={event=>setForm({...form,portfolio_url:event.target.value})}/></label><label>Tell us about your work<textarea required maxLength={2000} value={form.experience_description} onChange={event=>setForm({...form,experience_description:event.target.value})} placeholder="Training, clientele, specialties, products, certifications, notable work…"/></label><label className="lxapply-check"><input type="checkbox" checked={form.has_vehicle} onChange={event=>setForm({...form,has_vehicle:event.target.checked})}/><span>I have reliable transportation for mobile service requests.</span></label>{form.has_vehicle&&<label>Vehicle type<input value={form.vehicle_type} onChange={event=>setForm({...form,vehicle_type:event.target.value})} placeholder="Car, SUV, van…"/></label>}<label className="lxapply-check"><input required type="checkbox" checked={form.background_check_consent} onChange={event=>setForm({...form,background_check_consent:event.target.checked})}/><span>I consent to identity, credential, background, portfolio, and service-quality verification.</span></label></div>{error&&<div className="lxapply-error">{error}</div>}<button className="lxapply-submit" disabled={busy||selected.length===0}>{busy?'Submitting for review…':'Submit professional application'}</button><p className="lxapply-note">Submitting does not create an active stylist profile. Only approved, verified professionals are activated in the LUXE marketplace.</p></form></main></div>
}
