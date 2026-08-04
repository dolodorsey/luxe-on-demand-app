'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../lib/supabase'
import {
  authorizeLuxeBooking,
  cancelLuxeBooking,
  createLuxeBooking,
  loadLuxeBookings,
  loadLuxeCatalog,
  loadLuxeClientProfile,
  luxeBookingStage,
  rateLuxeBooking,
  type LuxeBooking,
  type LuxeCategory,
  type LuxeService,
} from '../lib/luxe-marketplace'

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

const CATEGORY_MARKS: Record<string,string> = {
  hair:'H', makeup:'M', lashes:'L', brows:'B', nails:'N', skincare:'S', waxing:'W',
  spray_tan:'G', mens_grooming:'MG', bridal_events:'BR', kids_teens:'KT', beauty_concierge:'LC', aesthetics_consult:'AC',
}
const CATEGORY_ART: Record<string,string> = {
  hair:'silk',makeup:'plum',lashes:'ink',brows:'rose',nails:'pearl',skincare:'sage',waxing:'sand',
  spray_tan:'bronze',mens_grooming:'charcoal',bridal_events:'champagne',kids_teens:'blush',beauty_concierge:'wine',aesthetics_consult:'clinical',
}
const STATUS_LABEL: Record<string,string> = {
  requested:'Talent matching',matched:'Stylist matched',accepted:'Appointment confirmed',en_route:'Stylist en route',
  arrived:'Stylist arrived',in_progress:'Service in progress',completed:'Completed',canceled:'Canceled',
}
const TRACK_STEPS = ['requested','matching','assigned','en_route','arrived','working','completed']
const stageRank = (status:string) => Math.max(0, TRACK_STEPS.indexOf(luxeBookingStage(status)))
const locate = () => new Promise<{lat:number|null;lng:number|null;label:string}>(resolve => {
  if (!navigator.geolocation) { resolve({lat:null,lng:null,label:'Enter mobile service address'});return }
  navigator.geolocation.getCurrentPosition(
    position => resolve({lat:position.coords.latitude,lng:position.coords.longitude,label:`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`}),
    () => resolve({lat:null,lng:null,label:'Enter mobile service address'}),
    { enableHighAccuracy:true,timeout:10000,maximumAge:30000 },
  )
})

function LuxeBrand() {
  return <div className="lx2-brand"><div className="lx2-monogram"><span>L</span></div><div><strong>LUXE</strong><small>On Demand</small></div></div>
}

function CategoryArt({ category, small=false }: { category:string; small?:boolean }) {
  return <div className={`lx2-category-art ${CATEGORY_ART[category] || 'wine'} ${small?'small':''}`}><span>{CATEGORY_MARKS[category] || category.slice(0,2).toUpperCase()}</span><i/><b/></div>
}

function PaymentForm({ onDone }: { onDone:()=>void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const submit = async () => {
    if (!stripe || !elements || busy) return
    setBusy(true);setError('')
    const result = await stripe.confirmPayment({elements,redirect:'if_required'})
    if (result.error) setError(result.error.message || 'Payment authorization failed')
    else onDone()
    setBusy(false)
  }
  return <div className="lx2-payment-form"><PaymentElement/><button disabled={!stripe||busy} onClick={submit}>{busy?'Authorizing…':'Authorize appointment total'}</button>{error&&<p>{error}</p>}<small>Your card is authorized after a stylist accepts and captured only after completion.</small></div>
}

function BookingTracker({ booking, onClose, onChanged }: { booking:LuxeBooking; onClose:()=>void; onChanged:(booking:LuxeBooking)=>void }) {
  const [current,setCurrent] = useState(booking)
  const [error,setError] = useState('')
  const [canceling,setCanceling] = useState(false)
  const rank = stageRank(current.status)
  const stylist = current.stylist
  const stylistName = stylist?.display_name || stylist?.business_name || [stylist?.user?.first_name,stylist?.user?.last_name].filter(Boolean).join(' ') || 'LUXE stylist'
  const mapLat = current.service_lat ?? 33.749
  const mapLng = current.service_lng ?? -84.388
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng-.035}%2C${mapLat-.025}%2C${mapLng+.035}%2C${mapLat+.025}&layer=mapnik&marker=${mapLat}%2C${mapLng}`

  useEffect(()=>{
    let active=true
    const refresh=async()=>{
      const {data,error:refreshError}=await supabase
        .from('cs_bookings')
        .select('*,stylist:cs_stylists!cs_bookings_stylist_id_fkey(id,display_name,business_name,rating,total_bookings,level,portfolio_urls,user:cs_users!cs_stylists_user_id_fkey(first_name,last_name,avatar_url))')
        .eq('id',current.id).single()
      if(!active)return
      if(refreshError)setError(refreshError.message)
      else {setCurrent(data as LuxeBooking);onChanged(data as LuxeBooking)}
    }
    refresh();const timer=window.setInterval(refresh,5000)
    return()=>{active=false;window.clearInterval(timer)}
  },[current.id,onChanged])

  const cancel=async()=>{
    setCanceling(true);setError('')
    try{const next=await cancelLuxeBooking(current.id);setCurrent(next);onChanged(next)}
    catch(cancelError){setError(cancelError instanceof Error?cancelError.message:'Unable to cancel')}
    finally{setCanceling(false)}
  }

  return <div className="lx2-tracker" role="dialog" aria-modal="true">
    <div className="lx2-tracker-scene">{current.service_mode==='mobile'?<><iframe title="LUXE appointment map" src={mapUrl}/><div className="lx2-map-veil"/><div className="lx2-map-marker"><span>L</span><i/></div></>:<div className="lx2-studio-scene"><div className="lx2-studio-arch"/><div className="lx2-studio-light"/><LuxeBrand/></div>}<div className="lx2-live"><span/> LIVE APPOINTMENT</div></div>
    <section className="lx2-tracker-sheet"><div className="lx2-handle"/><div className="lx2-tracker-head"><div><small>{current.service_mode==='mobile'?'MOBILE LUXE':'IN-STUDIO LUXE'}</small><h2>{STATUS_LABEL[current.status]||current.status}</h2><p>{current.status==='requested'?'Your request is being matched only with credentialed talent qualified for this exact service.':current.stylist_id?`${stylistName} is connected to your appointment.`:'Your booking is active. Talent details appear only after acceptance.'}</p></div><button onClick={onClose}>—</button></div>
      {stylist&&<div className="lx2-talent-card"><div>{stylist.user?.avatar_url?<img src={stylist.user.avatar_url} alt=""/>:stylistName.split(' ').map(part=>part[0]).slice(0,2).join('')}</div><span><small>VETTED LUXE TALENT</small><strong>{stylistName}</strong><em>★ {Number(stylist.rating||5).toFixed(1)} · {stylist.level||'LUXE Artist'} · {stylist.total_bookings||0} services</em></span>{current.eta_minutes&&<b>{current.eta_minutes}<small>MIN</small></b>}</div>}
      <div className="lx2-progress">{TRACK_STEPS.map((step,index)=><div key={step} className={`${index<=rank?'done':''} ${index===rank?'current':''}`}><span>{index<rank?'✓':index+1}</span><small>{step.replace('_',' ')}</small></div>)}</div>
      <div className="lx2-booking-facts"><div><small>SERVICE</small><strong>{current.subcategory_id?.replaceAll('_',' ')||'LUXE appointment'}</strong></div><div><small>{current.scheduled_at?'APPOINTMENT':'REQUEST'}</small><strong>{current.scheduled_at?new Date(current.scheduled_at).toLocaleString():`$${Number(current.estimated_price||0).toFixed(0)} starting`}</strong></div></div>
      {error&&<div className="lx2-error">{error}</div>}
      {['requested','matched','accepted'].includes(current.status)&&<button className="lx2-cancel" onClick={cancel} disabled={canceling}>{canceling?'Canceling…':'Cancel appointment'}</button>}
      <p className="lx2-truth">Talent identity, portfolio, movement, payment, and completion appear only from live verified records.</p>
    </section>
  </div>
}

export default function LuxeMarketplaceApp() {
  const [booting,setBooting] = useState(true)
  const [session,setSession] = useState<any>(null)
  const [profile,setProfile] = useState<any>(null)
  const [categories,setCategories] = useState<LuxeCategory[]>([])
  const [services,setServices] = useState<LuxeService[]>([])
  const [bookings,setBookings] = useState<LuxeBooking[]>([])
  const [tab,setTab] = useState<'home'|'services'|'appointments'|'profile'>('home')
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('all')
  const [selected,setSelected] = useState<LuxeService|null>(null)
  const [mode,setMode] = useState<'mobile'|'in_studio'>('mobile')
  const [timing,setTiming] = useState<'now'|'schedule'>('schedule')
  const [address,setAddress] = useState('')
  const [lat,setLat] = useState<number|null>(null)
  const [lng,setLng] = useState<number|null>(null)
  const [scheduledAt,setScheduledAt] = useState('')
  const [notes,setNotes] = useState('')
  const [requestBusy,setRequestBusy] = useState(false)
  const [requestError,setRequestError] = useState('')
  const [activeBooking,setActiveBooking] = useState<LuxeBooking|null>(null)
  const [trackerOpen,setTrackerOpen] = useState(false)
  const [authMode,setAuthMode] = useState<'signin'|'signup'>('signin')
  const [authName,setAuthName] = useState('')
  const [authEmail,setAuthEmail] = useState('')
  const [authPassword,setAuthPassword] = useState('')
  const [authBusy,setAuthBusy] = useState(false)
  const [authError,setAuthError] = useState('')
  const [payment,setPayment] = useState<{bookingId:string;clientSecret:string}|null>(null)
  const [toast,setToast] = useState('')

  const refreshBookings=async(nextProfile=profile)=>{
    if(!nextProfile?.id)return
    const next=await loadLuxeBookings(nextProfile.id);setBookings(next)
    setActiveBooking(next.find(booking=>!['completed','canceled'].includes(booking.status))||null)
  }

  useEffect(()=>{
    let active=true
    ;(async()=>{
      try{
        const [{categories:nextCategories,services:nextServices},{data:{session:nextSession}}]=await Promise.all([loadLuxeCatalog(),supabase.auth.getSession()])
        if(!active)return
        setCategories(nextCategories);setServices(nextServices);setSession(nextSession)
        if(nextSession?.user){const nextProfile=await loadLuxeClientProfile(nextSession.user.id);if(nextProfile.role==='stylist'){window.location.assign('/stylist');return}setProfile(nextProfile);await refreshBookings(nextProfile)}
      }catch(error){setAuthError(error instanceof Error?error.message:'LUXE could not start')}
      finally{if(active)setBooting(false)}
    })()
    const {data}=supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession))
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2200);return()=>clearTimeout(timer)},[toast])

  const featuredIds=['hr_silk_press','mk_full_glam','ls_hybrid_full','nl_gelx_medium','sk_signature_facial','bg_brow_lamination','bc_monthly_membership','be_bridal_pkg']
  const featured=useMemo(()=>featuredIds.map(id=>services.find(service=>service.id===id)).filter(Boolean) as LuxeService[],[services])
  const filtered=useMemo(()=>services.filter(service=>(category==='all'||service.category_id===category)&&(!query||`${service.name} ${service.description||''} ${service.category_id}`.toLowerCase().includes(query.toLowerCase()))),[services,category,query])

  const authenticate=async(event:React.FormEvent)=>{
    event.preventDefault();if(authBusy)return;setAuthBusy(true);setAuthError('')
    try{
      if(authMode==='signup'){const {error}=await supabase.auth.signUp({email:authEmail,password:authPassword,options:{data:{full_name:authName,role:'client',app:'luxe'}}});if(error)throw error}
      const {data,error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword});if(error)throw error
      const nextProfile=await loadLuxeClientProfile(data.user.id);setSession(data.session);setProfile(nextProfile);await refreshBookings(nextProfile)
    }catch(error){setAuthError(error instanceof Error?error.message:'Authentication failed')}
    finally{setAuthBusy(false)}
  }

  const openService=(service:LuxeService)=>{setSelected(service);setRequestError('');setMode(service.mobile_available?'mobile':'in_studio');setTiming('schedule');setScheduledAt('');setNotes('')}
  const useLocation=async()=>{const location=await locate();setLat(location.lat);setLng(location.lng);if(location.lat!=null&&!address)setAddress(location.label);if(location.lat==null)setToast('Enter your mobile service address manually.')}
  const submitRequest=async()=>{
    if(!selected||requestBusy)return;setRequestBusy(true);setRequestError('')
    try{
      if(mode==='mobile'&&address.trim().length<3)throw new Error('Enter the complete mobile service address.')
      if(timing==='schedule'&&!scheduledAt)throw new Error('Choose the appointment date and time.')
      if(selected.regulated&&selected.category_id==='aesthetics_consult'&&mode==='mobile')throw new Error('Aesthetics consults must follow the approved studio/clinical workflow.')
      const next=await createLuxeBooking({serviceName:selected.name,serviceMode:mode,address:mode==='mobile'?address.trim():null,latitude:lat,longitude:lng,scheduledAt:timing==='now'?null:new Date(scheduledAt).toISOString(),notes})
      setSelected(null);setActiveBooking(next);setTrackerOpen(true);setToast('Your LUXE request is live.');await refreshBookings(profile)
    }catch(error){setRequestError(error instanceof Error?error.message:'Appointment could not be requested')}
    finally{setRequestBusy(false)}
  }
  const startPayment=async(booking:LuxeBooking)=>{try{const result=await authorizeLuxeBooking(booking.id);setPayment({bookingId:booking.id,clientSecret:result.client_secret})}catch(error){setToast(error instanceof Error?error.message:'Authorization unavailable')}}

  if(booting)return <div className="lx2-loading"><div className="lx2-loader-monogram">L</div><div className="lx2-loader-line"/><span>Preparing your LUXE experience</span></div>
  if(!session)return <div className="lx2-auth"><div className="lx2-auth-art"><div className="lx2-ribbons"><i/><i/><i/></div><LuxeBrand/><div className="lx2-auth-copy"><span>BEAUTY. WHERE YOU ARE.</span><h1>Your beauty team.<br/><em>On your terms.</em></h1><p>292 services. Mobile or studio. Matched only with vetted talent qualified for your exact request.</p></div></div><form className="lx2-auth-panel" onSubmit={authenticate}><div className="lx2-segmented"><button type="button" className={authMode==='signin'?'active':''} onClick={()=>setAuthMode('signin')}>Sign in</button><button type="button" className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div>{authMode==='signup'&&<label>Full name<input required value={authName} onChange={event=>setAuthName(event.target.value)}/></label>}<label>Email<input required type="email" value={authEmail} onChange={event=>setAuthEmail(event.target.value)}/></label><label>Password<input required minLength={8} type="password" value={authPassword} onChange={event=>setAuthPassword(event.target.value)}/></label>{authError&&<div className="lx2-error">{authError}</div>}<button className="lx2-primary" disabled={authBusy}>{authBusy?'Connecting…':authMode==='signin'?'Enter LUXE':'Create account'}</button><a href="/stylist/apply" className="lx2-talent-link">Beauty professional? Apply to the LUXE talent network →</a></form></div>

  return <div className="lx2-app">
    <header className="lx2-topbar"><LuxeBrand/><button className="lx2-avatar" onClick={()=>setTab('profile')}>{profile?.first_name?.[0]||session.user.email?.[0]||'L'}</button></header>
    <main className="lx2-content">
      {tab==='home'&&<><section className="lx2-hero"><div className="lx2-hero-art"><div className="lx2-arch"/><div className="lx2-orb one"/><div className="lx2-orb two"/><div className="lx2-silk"/></div><div className="lx2-hero-copy"><span>WHITE-GLOVE BEAUTY MARKETPLACE</span><h1>Beauty,<br/><em>delivered beautifully.</em></h1><p>Choose the service, place, and time. LUXE matches the request with verified talent—not random availability.</p></div><button className="lx2-search-launch" onClick={()=>setTab('services')}><span>⌕</span><strong>Search 292 services</strong><em>›</em></button></section>{activeBooking&&<button className="lx2-active" onClick={()=>setTrackerOpen(true)}><span><small>LIVE APPOINTMENT</small><strong>{activeBooking.subcategory_id?.replaceAll('_',' ')||'LUXE request'}</strong><em>{STATUS_LABEL[activeBooking.status]||activeBooking.status}</em></span><b>OPEN</b></button>}<section className="lx2-edit"><div className="lx2-title"><span>THE LUXE EDIT</span><h2>Most requested</h2></div><div className="lx2-featured">{featured.map(service=><button key={service.id} onClick={()=>openService(service)}><CategoryArt category={service.category_id}/><div><span>{categories.find(item=>item.id===service.category_id)?.name}</span><strong>{service.name}</strong><small>{service.mobile_available?'Mobile':'Studio'} · {service.duration_minutes||'—'} min</small><em>${Number(service.base_price||0).toFixed(0)}+</em></div></button>)}</div></section><section className="lx2-categories"><div className="lx2-title"><span>EXPLORE</span><h2>Your beauty universe</h2></div><div className="lx2-category-grid">{categories.map(item=><button key={item.id} onClick={()=>{setCategory(item.id);setTab('services')}}><CategoryArt category={item.id} small/><div><strong>{item.name}</strong><small>{services.filter(service=>service.category_id===item.id).length} services</small></div></button>)}</div></section><section className="lx2-membership"><div><span>LUXE CONCIERGE</span><h2>One relationship.<br/>Every beauty need.</h2><p>Monthly maintenance, travel prep, recurring glam, and appointment planning through one premium account.</p></div><button onClick={()=>setToast('LUXE Concierge membership enrollment is next.')}>Explore membership</button></section><section className="lx2-talent-banner"><div><span>FOR BEAUTY PROFESSIONALS</span><h2>Bring your craft<br/>to LUXE.</h2><p>Apply, verify credentials, build your profile, and accept qualified requests.</p></div><a href="/stylist/apply">Apply to the network</a></section></>}
      {tab==='services'&&<section className="lx2-screen"><div className="lx2-screen-head"><span>SERVICE ATELIER</span><h1>Choose your service.</h1><p>{filtered.length} services across {categories.length} collections.</p></div><div className="lx2-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Silk press, glam, facial, bridal…"/>{query&&<button onClick={()=>setQuery('')}>×</button>}</div><div className="lx2-filter"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>All</button>{categories.map(item=><button key={item.id} className={category===item.id?'active':''} onClick={()=>setCategory(item.id)}>{item.name}</button>)}</div><div className="lx2-service-list">{filtered.map(service=><button key={service.id} onClick={()=>openService(service)}><CategoryArt category={service.category_id} small/><div><span>{categories.find(item=>item.id===service.category_id)?.name}</span><strong>{service.name}</strong><p>{service.description}</p><small>{service.mobile_available?'MOBILE':''}{service.mobile_available&&service.in_studio_available?' · ':''}{service.in_studio_available?'STUDIO':''}{service.regulated?' · CONSULTATION':''}</small></div><em>${Number(service.base_price||0).toFixed(0)}+</em></button>)}</div></section>}
      {tab==='appointments'&&<section className="lx2-screen"><div className="lx2-screen-head"><span>MY LUXE</span><h1>Appointments.</h1><p>Requests, matching, authorizations, and completed services.</p></div>{bookings.length===0?<div className="lx2-empty"><span>L</span><h2>Your book is open.</h2><p>Your requested and completed beauty services will appear here.</p><button onClick={()=>setTab('services')}>Browse services</button></div>:<div className="lx2-booking-list">{bookings.map(booking=><article key={booking.id}><button onClick={()=>{setActiveBooking(booking);setTrackerOpen(true)}}><span className={`lx2-status ${booking.status}`}/><div><strong>{booking.subcategory_id?.replaceAll('_',' ')||'LUXE service'}</strong><p>{booking.service_mode==='mobile'?booking.service_address:'In-studio appointment'}</p><small>{new Date(booking.created_at).toLocaleString()} · {STATUS_LABEL[booking.status]||booking.status}</small></div><em>${Number(booking.final_price||booking.estimated_price||0).toFixed(0)}</em></button>{booking.status==='accepted'&&<button className="lx2-pay" onClick={()=>startPayment(booking)}>Authorize appointment</button>}{booking.status==='completed'&&<div className="lx2-rating">Rate your LUXE experience {[1,2,3,4,5].map(value=><button key={value} onClick={async()=>{await rateLuxeBooking(booking.id,value);await refreshBookings();setToast('Rating saved.')}}>★</button>)}</div>}</article>)}</div>}</section>}
      {tab==='profile'&&<section className="lx2-screen"><div className="lx2-profile"><div>{profile?.first_name?.[0]||'L'}</div><span>LUXE CLIENT</span><h1>{[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||session.user.email}</h1><p>{session.user.email}</p></div><div className="lx2-menu"><button><span>♡</span><div><strong>Beauty profile</strong><small>Preferences, allergies, and service history</small></div><em>›</em></button><button><span>⌂</span><div><strong>Locations</strong><small>Home, hotel, venue, and studio preferences</small></div><em>›</em></button><button><span>▣</span><div><strong>Payment methods</strong><small>Secure appointment authorizations</small></div><em>›</em></button><button><span>♛</span><div><strong>LUXE Concierge</strong><small>Membership and recurring beauty planning</small></div><em>›</em></button><a href="/stylist/apply"><span>＋</span><div><strong>Join the talent network</strong><small>Apply as a licensed beauty professional</small></div><em>›</em></a><button className="danger" onClick={async()=>{await supabase.auth.signOut();setSession(null);setProfile(null);setBookings([])}}><span>↪</span><div><strong>Sign out</strong><small>End this session</small></div><em>›</em></button></div></section>}
    </main>
    <nav className="lx2-nav">{([['home','⌂','Home'],['services','◇','Services'],['appointments','◌','Appointments'],['profile','○','Profile']] as const).map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>
    {selected&&<div className="lx2-backdrop" onMouseDown={()=>setSelected(null)}><section className="lx2-service-sheet" onMouseDown={event=>event.stopPropagation()}><div className="lx2-handle"/><button className="lx2-close" onClick={()=>setSelected(null)}>×</button><CategoryArt category={selected.category_id}/><span>{categories.find(item=>item.id===selected.category_id)?.name}</span><h2>{selected.name}</h2><p>{selected.description}</p>{selected.compliance_note&&<div className="lx2-compliance">{selected.compliance_note}</div>}<div className="lx2-mode-tabs">{selected.mobile_available&&<button className={mode==='mobile'?'active':''} onClick={()=>setMode('mobile')}>Mobile</button>}{selected.in_studio_available&&<button className={mode==='in_studio'?'active':''} onClick={()=>setMode('in_studio')}>In studio</button>}</div><div className="lx2-timing-tabs"><button className={timing==='now'?'active':''} disabled={!selected.rush_eligible} onClick={()=>setTiming('now')}>As soon as available</button><button className={timing==='schedule'?'active':''} onClick={()=>setTiming('schedule')}>Schedule</button></div><div className="lx2-price"><div><small>STARTING PRICE</small><strong>${Number(selected.base_price||0).toFixed(0)}</strong><em>{mode==='mobile'&&selected.mobile_fee?`+ $${selected.mobile_fee} mobile fee`:selected.duration_minutes?`${selected.duration_minutes} minutes`:'Price confirmed before authorization'}</em></div><div><small>TALENT STANDARD</small><strong>VETTED</strong><em>{selected.provider_credential_required||'LUXE verification required'}</em></div></div>{mode==='mobile'&&<label>Service address<div><input value={address} onChange={event=>setAddress(event.target.value)} placeholder="Home, hotel, venue…"/><button onClick={useLocation}>⌖</button></div></label>}{timing==='schedule'&&<label>Date and time<input type="datetime-local" value={scheduledAt} onChange={event=>setScheduledAt(event.target.value)}/></label>}<label>Appointment notes<textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Hair length, desired look, allergies, event details…"/></label>{requestError&&<div className="lx2-error">{requestError}</div>}<button className="lx2-primary" disabled={requestBusy} onClick={submitRequest}>{requestBusy?'Sending to the talent network…':'Request LUXE appointment'}</button><p className="lx2-truth">A stylist is not assigned until vetted talent accepts. Portfolio, credentials, timing, and payment appear only from verified records.</p></section></div>}
    {trackerOpen&&activeBooking&&<BookingTracker booking={activeBooking} onClose={()=>{setTrackerOpen(false);refreshBookings()}} onChanged={next=>setActiveBooking(next)}/>} 
    {payment&&stripePromise&&<div className="lx2-backdrop" onMouseDown={()=>setPayment(null)}><section className="lx2-payment-sheet" onMouseDown={event=>event.stopPropagation()}><div className="lx2-handle"/><button className="lx2-close" onClick={()=>setPayment(null)}>×</button><span>SECURE AUTHORIZATION</span><h2>Authorize your appointment.</h2><Elements stripe={stripePromise} options={{clientSecret:payment.clientSecret,appearance:{theme:'night',variables:{colorPrimary:'#c7a66b'}}}}><PaymentForm onDone={()=>{setPayment(null);refreshBookings();setToast('Appointment authorized.')}}/></Elements></section></div>}
    {toast&&<div className="lx2-toast">{toast}</div>}
  </div>
}
