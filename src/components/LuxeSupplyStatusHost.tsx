'use client'

import { useEffect, useMemo, useState } from 'react'
import { luxeMobility } from '../lib/luxe-mobility'

type SupplyRow={
  vehicle_class_id:string
  vehicle_class_name:string
  approved_driver_count:number
  payout_ready_driver_count:number
  on_duty_driver_count:number
  has_requestable_supply:boolean
}

const normalize=(value:unknown)=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase()

export default function LuxeSupplyStatusHost(){
  const[rows,setRows]=useState<SupplyRow[]>([])
  const[loaded,setLoaded]=useState(false)
  const[notice,setNotice]=useState('')
  const supplyByName=useMemo(()=>new Map(rows.map(row=>[normalize(row.vehicle_class_name),row])),[rows])
  const requestable=rows.filter(row=>row.has_requestable_supply)
  const approved=rows.reduce((total,row)=>total+Number(row.approved_driver_count||0),0)
  const onDuty=rows.reduce((total,row)=>total+Number(row.on_duty_driver_count||0),0)

  useEffect(()=>{
    let active=true
    const load=async()=>{
      try{
        const {data,error}=await luxeMobility.rpc('lm_public_driver_supply')
        if(error)throw error
        if(active){setRows((data||[]) as SupplyRow[]);setLoaded(true)}
      }catch{if(active){setRows([]);setLoaded(true)}}
    }
    void load()
    const timer=window.setInterval(()=>void load(),60000)
    return()=>{active=false;window.clearInterval(timer)}
  },[])

  useEffect(()=>{
    if(!loaded)return
    const apply=()=>{
      for(const button of document.querySelectorAll<HTMLButtonElement>('.lm-classgrid>button')){
        const name=normalize(button.querySelector('span')?.textContent)
        const supply=supplyByName.get(name)
        if(!supply)continue
        button.dataset.requestableSupply=supply.has_requestable_supply?'true':'false'
        button.classList.toggle('lm-no-live-supply',!supply.has_requestable_supply)
        let badge=button.querySelector<HTMLSpanElement>('.lm-supply-badge')
        if(!badge){
          badge=document.createElement('span')
          badge.className='lm-supply-badge'
          badge.style.cssText='display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.06em;background:rgba(255,255,255,.08);color:rgba(255,255,255,.72)'
          button.appendChild(badge)
        }
        badge.textContent=supply.has_requestable_supply?`${supply.on_duty_driver_count} verified driver${Number(supply.on_duty_driver_count)===1?'':'s'} on duty`:'Verified driver network activating'
      }

      const activeClass=document.querySelector<HTMLButtonElement>('.lm-classgrid>button.active')
      const selectedName=normalize(activeClass?.querySelector('span')?.textContent)
      const selectedSupply=supplyByName.get(selectedName)
      const request=document.querySelector<HTMLButtonElement>('.lm-classes>.lm-primary.wide')
      if(request&&selectedSupply&&!selectedSupply.has_requestable_supply){
        request.setAttribute('aria-disabled','true')
        request.dataset.supplyBlocked='true'
      }else if(request){
        request.removeAttribute('aria-disabled')
        delete request.dataset.supplyBlocked
      }
    }

    apply()
    const observer=new MutationObserver(apply)
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']})

    const block=(event:Event)=>{
      const target=event.target as HTMLElement|null
      const request=target?.closest?.('.lm-classes>.lm-primary.wide') as HTMLButtonElement|null
      if(!request||request.dataset.supplyBlocked!=='true')return
      event.preventDefault()
      event.stopImmediatePropagation()
      const activeClass=document.querySelector<HTMLButtonElement>('.lm-classgrid>button.active')
      const selectedName=normalize(activeClass?.querySelector('span')?.textContent)
      const selectedSupply=supplyByName.get(selectedName)
      setNotice(selectedSupply
        ? `No approved, payout-ready LUXE driver is on duty for ${selectedSupply.vehicle_class_name} right now. No ride was created.`
        : 'Verified LUXE driver availability could not be confirmed. No ride was created.')
    }
    document.addEventListener('click',block,true)
    return()=>{observer.disconnect();document.removeEventListener('click',block,true)}
  },[loaded,supplyByName])

  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4500);return()=>window.clearTimeout(timer)},[notice])

  if(!loaded)return null
  return <>
    <section style={{margin:'12px auto',width:'min(1120px,calc(100% - 24px))',padding:'12px 14px',border:'1px solid rgba(255,255,255,.10)',borderRadius:16,background:'rgba(8,10,15,.88)',color:'#f5f1e8',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap'}} aria-label="LUXE verified driver availability">
      <div><small style={{display:'block',fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#d4b87a'}}>VERIFIED DRIVER NETWORK</small><strong style={{display:'block',marginTop:3,fontSize:14}}>{requestable.length?`${onDuty} approved driver${onDuty===1?'':'s'} on duty across ${requestable.length} class${requestable.length===1?'':'es'}.`:'Rider requests are waiting on verified driver supply.'}</strong><span style={{display:'block',marginTop:3,fontSize:11,color:'rgba(245,241,232,.56)'}}>{approved?`${approved} approved driver record${approved===1?'':'s'} total; class availability still requires payout readiness and on-duty status.`:'No driver applications have reached approved supply yet.'}</span></div>
      <a href="/apply" style={{padding:'9px 12px',borderRadius:11,textDecoration:'none',fontSize:10,fontWeight:900,letterSpacing:'.08em',background:'#d4b87a',color:'#09080c'}}>APPLY TO DRIVE →</a>
    </section>
    {notice&&<div role="status" style={{position:'fixed',left:'50%',bottom:24,transform:'translateX(-50%)',zIndex:5000,width:'min(460px,calc(100% - 28px))',padding:'12px 14px',borderRadius:14,background:'#12131a',color:'#fff',boxShadow:'0 18px 60px rgba(0,0,0,.4)',fontSize:12}}>{notice}</div>}
  </>
}
