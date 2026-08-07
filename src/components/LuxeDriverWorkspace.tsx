'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { acceptRide, getMobilitySession, loadDriverOffers, loadMyProfile, luxeMobility, transitionRide, type LuxeRide } from '../lib/luxe-mobility'
import { loadDriverActiveRides } from '../lib/luxe-driver'
import '../app/luxe-mobility.css'

const nextAction:Record<string,{label:string;status:'en_route'|'arrived'|'in_progress'|'completed'}|undefined>={
  accepted:{label:'Start driving to rider',status:'en_route'},
  en_route:{label:'Mark arrived',status:'arrived'},
  arrived:{label:'Start trip',status:'in_progress'},
  in_progress:{label:'Complete trip',status:'completed'},
}

export default function LuxeDriverWorkspace(){
  const [loading,setLoading]=useState(true)
  const [profile,setProfile]=useState<any>(null)
  const [offers,setOffers]=useState<LuxeRide[]>([])
  const [active,setActive]=useState<LuxeRide[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState('')

  const refresh=useCallback(async()=>{
    const [nextOffers,nextActive]=await Promise.all([loadDriverOffers(),loadDriverActiveRides()])
    setOffers(nextOffers);setActive(nextActive)
  },[])

  useEffect(()=>{
    ;(async()=>{
      try{
        const session=await getMobilitySession()
        if(!session){window.location.assign('/');return}
        const nextProfile=await loadMyProfile()
        if(!nextProfile||nextProfile.role!=='driver'){window.location.assign('/');return}
        setProfile(nextProfile);await refresh()
      }catch(error){setMessage(error instanceof Error?error.message:'Driver workspace unavailable')}
      finally{setLoading(false)}
    })()
  },[refresh])

  const accept=async(rideId:string)=>{
    setBusy(rideId);setMessage('')
    try{await acceptRide(rideId);await refresh();setMessage('Ride accepted. Rider can now authorize the fare.')}
    catch(error){setMessage(error instanceof Error?error.message:'Could not accept ride')}
    finally{setBusy('')}
  }

  const advance=async(ride:LuxeRide)=>{
    const action=nextAction[ride.status]
    if(!action)return
    setBusy(ride.id);setMessage('')
    try{
      const updated=await transitionRide(ride.id,action.status)
      if(updated.status==='completed'){
        const capture=await luxeMobility.functions.invoke('luxe-mobility-payments',{body:{action:'capture',rideId:ride.id}})
        if(capture.error)throw new Error(`Trip completed, but payment capture needs attention: ${capture.error.message}`)
      }
      await refresh();setMessage(updated.status==='completed'?'Trip completed and capture requested.':'Trip status updated.')
    }catch(error){setMessage(error instanceof Error?error.message:'Trip update failed')}
    finally{setBusy('')}
  }

  const live=useMemo(()=>active[0]||null,[active])
  if(loading)return <div className="lm-loading"><span>LUXE</span><i/><p>Opening driver network</p></div>

  return <main className="lm-shell">
    <header><div className="lm-wordmark dark">LUXE<small>DRIVER</small></div><div className="lm-user"><span>{profile?.full_name||'Driver'}</span><button onClick={async()=>{await luxeMobility.auth.signOut();window.location.assign('/')}}>Sign out</button></div></header>
    <section className="lm-driver-hero"><span>DRIVER NETWORK</span><h1>{live?'Your active trip.':'Ready when you are.'}</h1><p>Only rides matching your approved vehicle class are visible. Fare authorization is required before you can begin travel.</p></section>

    {message&&<section className="lm-offers"><div className="lm-note">{message}</div></section>}

    {live&&<section className="lm-offers"><article><div><small>ACTIVE TRIP · {live.status.replace('_',' ').toUpperCase()}</small><strong>{live.pickup_address}</strong><span>to</span><strong>{live.destination_address}</strong><small>{live.route_distance_miles} mi · {live.route_duration_minutes} min · ${Number(live.quoted_fare).toFixed(2)}</small></div>{nextAction[live.status]&&<button className="lm-primary" disabled={busy===live.id} onClick={()=>advance(live)}>{busy===live.id?'Updating…':nextAction[live.status]?.label}</button>}</article></section>}

    {!live&&<section className="lm-offers">{offers.length===0?<div className="lm-empty">No matching LUXE requests right now.</div>:offers.map(ride=><article key={ride.id}><div><strong>{ride.pickup_address}</strong><span>to</span><strong>{ride.destination_address}</strong><small>{ride.route_distance_miles} mi · {ride.route_duration_minutes} min · ${Number(ride.quoted_fare).toFixed(2)}</small></div><button className="lm-primary" disabled={busy===ride.id} onClick={()=>accept(ride.id)}>{busy===ride.id?'Accepting…':'Accept ride'}</button></article>)}</section>}
  </main>
}
