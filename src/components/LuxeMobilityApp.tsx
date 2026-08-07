'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import {
  LUXE_BACKEND_MODE,
  acceptRide,
  authorizeRidePayment,
  cancelRide,
  ensureRiderProfile,
  getMobilitySession,
  loadDriverOffers,
  loadMyProfile,
  loadMyRides,
  loadVehicleClasses,
  luxeMobility,
  quoteRide,
  rateRide,
  requestRide,
  signInMobility,
  signUpMobility,
  transitionRide,
  type LuxeRide,
  type VehicleClass,
} from '../lib/luxe-mobility'
import '../app/luxe-mobility.css'

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

const statusCopy:Record<string,string> = {
  matching:'Matching you with a LUXE driver', accepted:'Driver confirmed', en_route:'Driver is on the way',
  arrived:'Your driver has arrived', in_progress:'Trip in progress', completed:'Trip completed', canceled:'Trip canceled',
}

function Money({value}:{value:number|null|undefined}) {
  return <>{value==null?'—':`$${Number(value).toFixed(2)}`}</>
}

function PaymentAuthorization({clientSecret,onDone}:{clientSecret:string;onDone:()=>void}) {
  const stripe=useStripe(); const elements=useElements(); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  const submit=async()=>{
    if(!stripe||!elements||busy)return
    setBusy(true);setError('')
    const result=await stripe.confirmPayment({elements,redirect:'if_required'})
    if(result.error)setError(result.error.message||'Payment authorization failed')
    else onDone()
    setBusy(false)
  }
  return <div className="lm-paybox"><PaymentElement/><button className="lm-primary" onClick={submit} disabled={busy||!stripe}>{busy?'Authorizing…':'Authorize fare'}</button>{error&&<p className="lm-error">{error}</p>}</div>
}

export default function LuxeMobilityApp(){
  const [booting,setBooting]=useState(true)
  const [session,setSession]=useState<any>(null)
  const [profile,setProfile]=useState<any>(null)
  const [vehicles,setVehicles]=useState<VehicleClass[]>([])
  const [rides,setRides]=useState<LuxeRide[]>([])
  const [offers,setOffers]=useState<LuxeRide[]>([])
  const [authMode,setAuthMode]=useState<'signin'|'signup'>('signin')
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [authBusy,setAuthBusy]=useState(false)
  const [authMessage,setAuthMessage]=useState('')
  const [pickup,setPickup]=useState('')
  const [destination,setDestination]=useState('')
  const [vehicleId,setVehicleId]=useState('luxe_black')
  const [distance,setDistance]=useState(8)
  const [minutes,setMinutes]=useState(22)
  const [scheduledAt,setScheduledAt]=useState('')
  const [quote,setQuote]=useState<number|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [payment,setPayment]=useState<{rideId:string;clientSecret:string}|null>(null)

  const refresh=useCallback(async(nextProfile:any=profile)=>{
    if(!nextProfile?.id)return
    if(nextProfile.role==='driver'){
      setOffers(await loadDriverOffers())
      return
    }
    setRides(await loadMyRides(nextProfile.id))
  },[profile])

  useEffect(()=>{
    let active=true
    ;(async()=>{
      try{
        const [nextSession,nextVehicles]=await Promise.all([getMobilitySession(),loadVehicleClasses()])
        if(!active)return
        setVehicles(nextVehicles);setSession(nextSession)
        if(nextSession?.user){
          let nextProfile=await loadMyProfile()
          if(!nextProfile){
            const fullName=String(nextSession.user.user_metadata?.full_name||nextSession.user.email?.split('@')[0]||'LUXE Rider')
            nextProfile=await ensureRiderProfile(fullName)
          }
          setProfile(nextProfile);await refresh(nextProfile)
        }
      }catch(error){setMessage(error instanceof Error?error.message:'LUXE could not connect')}
      finally{if(active)setBooting(false)}
    })()
    const {data}=luxeMobility.auth.onAuthStateChange((_event,next)=>setSession(next))
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])

  useEffect(()=>{
    let active=true
    if(!vehicleId||distance<=0||minutes<=0){setQuote(null);return}
    quoteRide(vehicleId,distance,minutes).then(value=>{if(active)setQuote(value)}).catch(()=>{if(active)setQuote(null)})
    return()=>{active=false}
  },[vehicleId,distance,minutes])

  const activeRide=useMemo(()=>rides.find(ride=>!['completed','canceled'].includes(ride.status))||null,[rides])

  const authenticate=async(event:React.FormEvent)=>{
    event.preventDefault();if(authBusy)return;setAuthBusy(true);setAuthMessage('')
    try{
      if(authMode==='signup'){
        const result=await signUpMobility(email,password,name)
        if(!result.session){setAuthMessage('Check your email to confirm your LUXE account, then sign in.');setAuthMode('signin');setPassword('');return}
      }else await signInMobility(email,password)
      const nextSession=await getMobilitySession();setSession(nextSession)
      if(nextSession?.user){let nextProfile=await loadMyProfile();if(!nextProfile)nextProfile=await ensureRiderProfile(name||nextSession.user.email?.split('@')[0]||'LUXE Rider');setProfile(nextProfile);await refresh(nextProfile)}
    }catch(error){setAuthMessage(error instanceof Error?error.message:'Authentication failed')}
    finally{setAuthBusy(false)}
  }

  const submitRide=async()=>{
    if(busy)return;setBusy(true);setMessage('')
    try{
      if(!pickup.trim()||!destination.trim())throw new Error('Enter pickup and destination.')
      const ride=await requestRide({vehicleClassId:vehicleId,pickup:pickup.trim(),destination:destination.trim(),distanceMiles:distance,durationMinutes:minutes,scheduledAt:scheduledAt?new Date(scheduledAt).toISOString():null})
      setMessage('Ride request created. Matching with a verified LUXE driver.');setRides(current=>[ride,...current])
    }catch(error){setMessage(error instanceof Error?error.message:'Ride request failed')}
    finally{setBusy(false)}
  }

  const startPayment=async(ride:LuxeRide)=>{
    try{
      if(!stripePromise)throw new Error('Stripe publishable configuration is not available on this preview.')
      const result=await authorizeRidePayment(ride.id);setPayment({rideId:ride.id,clientSecret:result.clientSecret})
    }catch(error){setMessage(error instanceof Error?error.message:'Payment authorization unavailable')}
  }

  if(booting)return <div className="lm-loading"><span>LUXE</span><i/><p>Opening premium mobility</p></div>

  if(!session)return <main className="lm-auth">
    <section className="lm-auth-visual"><div className="lm-wordmark">LUXE<small>ON DEMAND</small></div><div className="lm-road"><i/><i/><i/></div><div className="lm-auth-copy"><span>PREMIUM MOBILITY, ON YOUR TIME</span><h1>Your city.<br/>Your driver.<br/><em>Your standard.</em></h1><p>Private rides, airport movement and executive transportation from one premium network.</p></div></section>
    <form onSubmit={authenticate} className="lm-auth-form"><div className="lm-switch"><button type="button" className={authMode==='signin'?'active':''} onClick={()=>setAuthMode('signin')}>Sign in</button><button type="button" className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div>{authMode==='signup'&&<label>Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)}/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{authMessage&&<div className="lm-note">{authMessage}</div>}<button className="lm-primary" disabled={authBusy}>{authBusy?'Connecting…':authMode==='signin'?'Enter LUXE':'Create LUXE account'}</button><small className="lm-stage">Controlled closure environment · {LUXE_BACKEND_MODE}</small></form>
  </main>

  if(profile?.role==='driver')return <main className="lm-shell"><header><div className="lm-wordmark dark">LUXE<small>DRIVER</small></div><button onClick={async()=>{await luxeMobility.auth.signOut();location.reload()}}>Sign out</button></header><section className="lm-driver-hero"><span>DRIVER NETWORK</span><h1>Available rides.</h1><p>Only rides matching your approved vehicle class appear here.</p></section><section className="lm-offers">{offers.length===0?<div className="lm-empty">No matching requests right now.</div>:offers.map(ride=><article key={ride.id}><div><strong>{ride.pickup_address}</strong><span>to</span><strong>{ride.destination_address}</strong><small>{ride.route_distance_miles} mi · {ride.route_duration_minutes} min · <Money value={ride.quoted_fare}/></small></div><button className="lm-primary" onClick={async()=>{await acceptRide(ride.id);await refresh(profile)}}>Accept ride</button></article>)}</section></main>

  return <main className="lm-shell">
    <header><div className="lm-wordmark dark">LUXE<small>ON DEMAND</small></div><div className="lm-user"><span>{profile?.full_name||'Rider'}</span><button onClick={async()=>{await luxeMobility.auth.signOut();location.reload()}}>Sign out</button></div></header>
    <section className="lm-hero"><div><span>WHERE TO?</span><h1>Move like<br/>you mean it.</h1><p>Choose your class. Confirm your route. A verified driver accepts before the trip becomes active.</p></div><div className="lm-citycard"><b>ATL</b><span>Premium network preview</span></div></section>

    {activeRide&&<section className="lm-active"><div><span>ACTIVE RIDE</span><h2>{statusCopy[activeRide.status]||activeRide.status}</h2><p>{activeRide.pickup_address}<b>→</b>{activeRide.destination_address}</p></div><div><Money value={activeRide.quoted_fare}/>{activeRide.status==='accepted'&&<button onClick={()=>startPayment(activeRide)}>Authorize fare</button>}{['matching','accepted','en_route'].includes(activeRide.status)&&<button className="ghost" onClick={async()=>{await cancelRide(activeRide.id,'Canceled by rider');await refresh(profile)}}>Cancel</button>}</div></section>}

    <section className="lm-booker"><div className="lm-field"><span>01</span><label>Pickup<input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Pickup address"/></label></div><div className="lm-field"><span>02</span><label>Destination<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Where are you going?"/></label></div><div className="lm-route-metrics"><label>Route miles<input type="number" min="0.1" step="0.1" value={distance} onChange={e=>setDistance(Number(e.target.value))}/></label><label>Est. minutes<input type="number" min="1" step="1" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><label>Schedule<input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label><small>Closure QA uses explicit route metrics until the production routing provider is connected.</small></div></section>

    <section className="lm-classes"><div className="lm-sectionhead"><span>SELECT YOUR CLASS</span><h2>Arrive correctly.</h2></div><div className="lm-classgrid">{vehicles.map(vehicle=><button key={vehicle.id} className={vehicleId===vehicle.id?'active':''} onClick={()=>setVehicleId(vehicle.id)}><div className="lm-car"><i/><i/></div><span>{vehicle.name}</span><p>{vehicle.description}</p><small>Up to {vehicle.capacity}</small><strong>{vehicleId===vehicle.id&&quote!=null?<Money value={quote}/>:<Money value={vehicle.minimum_fare}/>}</strong></button>)}</div><button className="lm-primary wide" onClick={submitRide} disabled={busy||!!activeRide}>{busy?'Requesting…':activeRide?'Complete or cancel active ride first':quote!=null?`Request ride · $${quote.toFixed(2)}`:'Request ride'}</button>{message&&<div className="lm-note">{message}</div>}</section>

    <section className="lm-history"><div className="lm-sectionhead"><span>YOUR MOVEMENT</span><h2>Ride history.</h2></div>{rides.length===0?<div className="lm-empty">Your rides will appear here from request through receipt.</div>:rides.map(ride=><article key={ride.id}><div><span className={`lm-status ${ride.status}`}/><div><strong>{ride.pickup_address}</strong><small>{ride.destination_address}</small><em>{statusCopy[ride.status]||ride.status}</em></div></div><div><Money value={ride.final_fare??ride.quoted_fare}/>{ride.status==='completed'&&<div className="lm-stars">{[1,2,3,4,5].map(value=><button key={value} onClick={async()=>{await rateRide(ride.id,value);setMessage('Rating saved.')}}>★</button>)}</div>}</div></article>)}</section>

    {payment&&stripePromise&&<div className="lm-backdrop" onMouseDown={()=>setPayment(null)}><section className="lm-payment" onMouseDown={e=>e.stopPropagation()}><button className="lm-close" onClick={()=>setPayment(null)}>×</button><span>SECURE AUTHORIZATION</span><h2>Authorize your LUXE fare.</h2><p>Your card is authorized before driver travel and captured after the completed trip.</p><Elements stripe={stripePromise} options={{clientSecret:payment.clientSecret,appearance:{theme:'night'}}}><PaymentAuthorization clientSecret={payment.clientSecret} onDone={()=>{setPayment(null);refresh(profile);setMessage('Fare authorized.')}}/></Elements></section></div>}
  </main>
}
