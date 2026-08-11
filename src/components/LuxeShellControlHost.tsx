'use client'

import {useEffect,useState}from'react'
import{createPortal}from'react-dom'

export default function LuxeShellControlHost(){
  const[header,setHeader]=useState<HTMLElement|null>(null)

  useEffect(()=>{
    const sync=()=>setHeader(document.querySelector<HTMLElement>('.lm-shell > header'))
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])

  const goBack=()=>{
    const close=document.querySelector<HTMLElement>('.lm-subcat-backdrop .lm-subcat-close, .lm-backdrop .lm-close')
    if(close){close.click();return}
    if(window.history.length>1){window.history.back();return}
    document.querySelector<HTMLElement>('.lm-shell')?.scrollTo?.({top:0,behavior:'smooth'})
  }

  return <>
    <style>{`
      .lm-shell{height:100dvh!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important}
      .lm-shell>header{position:sticky!important;top:0!important;z-index:80!important;justify-content:flex-start!important;gap:10px!important}
      .lm-shell>header .lm-shell-back{order:-1}.lm-shell>header .lm-wordmark{order:0;margin-right:auto}.lm-shell>header .lm-user{order:1}
      .lm-shell-back{height:40px;min-width:62px;padding:0 10px;border-radius:12px!important;border:1px solid #d9d0c1!important;background:#111!important;color:#d8b56f!important;display:flex;align-items:center;justify-content:center;gap:4px;font:900 8px Inter,sans-serif!important;letter-spacing:.08em;flex:0 0 auto}
      .lm-shell-back span{font-size:20px;line-height:1;margin-top:-2px}
      @media(max-width:520px){.lm-shell>header{padding-left:12px!important;padding-right:12px!important}.lm-shell-back{min-width:43px;padding:0 7px;font-size:0!important}.lm-shell-back span{font-size:23px}.lm-user>span{display:none}}
    `}</style>
    {header?createPortal(<button type="button" className="lm-shell-back" onClick={goBack} aria-label="Go back"><span>‹</span>BACK</button>,header):null}
  </>
}
