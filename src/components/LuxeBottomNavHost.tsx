'use client'

import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'

export default function LuxeBottomNavHost(){
  const[mounted,setMounted]=useState(false)
  const[active,setActive]=useState<'home'|'classes'|'rides'|'profile'>('home')

  useEffect(()=>{
    const sync=()=>setMounted(Boolean(document.querySelector('.lm-shell .lm-classes')))
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])

  const jump=(id:'home'|'classes'|'rides'|'profile',selector:string)=>{
    setActive(id)
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  if(!mounted||typeof document==='undefined')return null
  return createPortal(
    <nav className="lm-bottom-nav" aria-label="LUXE rider navigation">
      <button className={active==='home'?'active':''} onClick={()=>jump('home','.lm-hero')}><span>⌂</span><small>Home</small></button>
      <button className={active==='classes'?'active':''} onClick={()=>jump('classes','.lm-classes')}><span>◇</span><small>Classes</small></button>
      <button className={active==='rides'?'active':''} onClick={()=>jump('rides','.lm-history')}><span>◎</span><small>Rides</small></button>
      <button className={active==='profile'?'active':''} onClick={()=>jump('profile','.lm-shell>header')}><span>○</span><small>Profile</small></button>
    </nav>,document.body
  )
}
