'use client'

import { useEffect, useMemo, useState } from 'react'
import { luxeMobility, type VehicleClass } from '../lib/luxe-mobility'

type RideMode = 'now' | 'scheduled'

export default function LuxeSubcategoryRestoreHost(){
  const [classes,setClasses]=useState<VehicleClass[]>([])
  const [open,setOpen]=useState(false)
  const [mode,setMode]=useState<RideMode>('now')
  const [mounted,setMounted]=useState(false)

  useEffect(()=>{
    let alive=true
    luxeMobility.from('lm_vehicle_classes').select('*').eq('is_active',true).order('sort_order').then(({data,error})=>{
      if(alive&&!error)setClasses((data||[]) as VehicleClass[])
    })
    const sync=()=>setMounted(Boolean(document.querySelector('.lm-shell')))
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true})
    return()=>{alive=false;observer.disconnect()}
  },[])

  const total=useMemo(()=>classes.length*2,[classes.length])

  const chooseClass=(vehicle:VehicleClass)=>{
    setOpen(false)
    const classButtons=[...document.querySelectorAll<HTMLButtonElement>('.lm-classgrid button')]
    const button=classButtons.find(item=>String(item.textContent||'').toLowerCase().includes(vehicle.name.toLowerCase()))
    button?.click()
    const target=document.querySelector('.lm-booker')||document.querySelector('.lm-classes')
    target?.scrollIntoView({behavior:'smooth',block:'start'})
    if(mode==='scheduled')window.setTimeout(()=>document.querySelector<HTMLInputElement>('.lm-route-metrics input[type="datetime-local"]')?.focus(),450)
  }

  if(!mounted||!classes.length)return null

  return <>
    <style>{`
      .lm-subcat-launch{position:fixed;right:16px;bottom:18px;z-index:88;border:1px solid rgba(191,158,100,.35);border-radius:999px;background:rgba(12,11,10,.94);color:#f8f2e8;padding:10px 13px;font:800 8px Arial,sans-serif;letter-spacing:.1em;box-shadow:0 16px 42px rgba(0,0,0,.35);backdrop-filter:blur(18px)}.lm-subcat-launch b{color:#d8b56f;margin-left:6px}
      .lm-subcat-backdrop{position:fixed;inset:0;z-index:220;background:rgba(4,4,4,.82);backdrop-filter:blur(20px);display:flex;align-items:flex-end;justify-content:center}.lm-subcat-sheet{width:min(100%,540px);max-height:86dvh;overflow:auto;border-radius:30px 30px 0 0;padding:12px 18px calc(26px + env(safe-area-inset-bottom));background:radial-gradient(circle at 85% 0%,rgba(216,181,111,.14),transparent 34%),linear-gradient(155deg,#1b1814,#080808 72%);border-top:1px solid rgba(216,181,111,.22);color:#fff;box-shadow:0 -30px 90px rgba(0,0,0,.6)}
      .lm-subcat-handle{width:44px;height:4px;border-radius:99px;background:rgba(255,255,255,.22);margin:0 auto 20px}.lm-subcat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.lm-subcat-head span{font-size:8px;letter-spacing:.17em;color:#d8b56f;font-weight:900}.lm-subcat-head h2{font:700 31px/1.02 Georgia,serif;letter-spacing:-.04em;margin:7px 0}.lm-subcat-head p{margin:0;color:rgba(255,255,255,.56);font-size:9px;line-height:1.55}.lm-subcat-close{width:40px;height:40px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-size:20px}
      .lm-subcat-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 14px}.lm-subcat-modes button{min-height:48px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#111;color:rgba(255,255,255,.62);font-size:9px;font-weight:800}.lm-subcat-modes button.active{border-color:rgba(216,181,111,.5);background:#30281d;color:#e7c888}.lm-subcat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.lm-subcat-card{min-height:150px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:linear-gradient(150deg,#1a1815,#0b0b0b);color:#fff;text-align:left;display:flex;flex-direction:column;gap:6px}.lm-subcat-card small{font-size:7px;color:#d8b56f;letter-spacing:.09em}.lm-subcat-card strong{font:700 17px/1.05 Georgia,serif}.lm-subcat-card p{margin:0;font-size:7px;line-height:1.45;color:rgba(255,255,255,.52)}.lm-subcat-card em{margin-top:auto;font-style:normal;color:#e7c888;font-size:9px;font-weight:900}.lm-subcat-note{margin-top:13px;font-size:7px;line-height:1.5;color:rgba(255,255,255,.38);text-align:center}@media(max-width:430px){.lm-subcat-grid{grid-template-columns:1fr}.lm-subcat-card{min-height:105px}}
    `}</style>
    <button type="button" className="lm-subcat-launch" onClick={()=>setOpen(true)}>RIDE SUBCATEGORIES <b>{total}</b></button>
    {open&&<div className="lm-subcat-backdrop" onMouseDown={()=>setOpen(false)}><section className="lm-subcat-sheet" onMouseDown={event=>event.stopPropagation()} role="dialog" aria-modal="true"><div className="lm-subcat-handle"/><div className="lm-subcat-head"><div><span>LUXE MOBILITY DIRECTORY</span><h2>Choose how you move.</h2><p>Ride timing first, then vehicle class. Every option below maps to the current LUXE mobility booking flow.</p></div><button className="lm-subcat-close" onClick={()=>setOpen(false)}>×</button></div><div className="lm-subcat-modes"><button className={mode==='now'?'active':''} onClick={()=>setMode('now')}>ON-DEMAND RIDE</button><button className={mode==='scheduled'?'active':''} onClick={()=>setMode('scheduled')}>SCHEDULED RIDE</button></div><div className="lm-subcat-grid">{classes.map(vehicle=><button key={vehicle.id} className="lm-subcat-card" onClick={()=>chooseClass(vehicle)}><small>{mode==='now'?'ON DEMAND':'SCHEDULED'}</small><strong>{vehicle.name}</strong><p>{vehicle.description||'Premium LUXE vehicle class.'}</p><em>UP TO {vehicle.capacity} · FROM ${Number(vehicle.minimum_fare||0).toFixed(0)}</em></button>)}</div><p className="lm-subcat-note">Airport, corporate, guest and concierge extensions stay separate until their complete production booking flows are activated.</p></section></div>}
  </>
}
