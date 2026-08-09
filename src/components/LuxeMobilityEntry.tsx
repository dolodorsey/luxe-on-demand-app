'use client'

import { useEffect, useState } from 'react'
import LuxeMobilityApp from './LuxeMobilityApp'
import LuxeDriverWorkspace from './LuxeDriverWorkspace'
import { getMobilitySession, loadMyProfile } from '../lib/luxe-mobility'

export default function LuxeMobilityEntry(){
  const [role,setRole]=useState<'loading'|'driver'|'rider'>('loading')

  useEffect(()=>{
    let active=true
    ;(async()=>{
      try{
        const session=await getMobilitySession()
        if(!session){if(active)setRole('rider');return}
        const profile=await loadMyProfile()
        if(active)setRole(profile?.role==='driver'?'driver':'rider')
      }catch{if(active)setRole('rider')}
    })()
    return()=>{active=false}
  },[])

  if(role==='loading')return <div className="lm-loading"><span>LUXE</span><i/><p>Connecting your mobility profile</p></div>
  return role==='driver'?<LuxeDriverWorkspace/>:<LuxeMobilityApp/>
}
