'use client'

import { useEffect,useState } from 'react'

type PromptEvent=Event&{prompt:()=>Promise<{outcome:'accepted'|'dismissed'}>}

function forceInstall(){try{return new URLSearchParams(location.search).get('install')==='1'}catch{return false}}
function InstallQr(){
  const [qr,setQr]=useState('');
  useEffect(()=>{if(typeof window==='undefined'||window.innerWidth<760)return;try{const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('install','1');setQr('https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/app-install-qr?url='+encodeURIComponent(u.toString()))}catch{}},[]);
  if(!qr)return null;
  return <aside aria-label="Scan to install app" style={{position:'fixed',right:22,bottom:22,zIndex:2147483002,width:188,padding:12,borderRadius:20,background:'rgba(7,8,11,.97)',border:'1px solid rgba(255,255,255,.16)',boxShadow:'0 24px 70px rgba(0,0,0,.48)',color:'#fff',fontFamily:'Arial,sans-serif'}}>
    <img src={qr} alt="QR code to install this app" width="164" height="164" style={{display:'block',width:'100%',height:'auto',borderRadius:12,background:'#fff',padding:6}}/>
    <strong style={{display:'block',marginTop:10,fontSize:10,letterSpacing:'.14em'}}>SCAN TO GET THE APP</strong>
    <small style={{display:'block',marginTop:5,color:'rgba(255,255,255,.62)',fontSize:9,lineHeight:1.45}}>iPhone: Share → Add to Home Screen → Open as Web App → Add. Android: tap Install App.</small>
  </aside>
}

const DISMISS_MS=7*24*60*60*1000
const COLLECTOR='https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/marketing-event-capture'
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
const native=()=>Boolean((window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean}}).Capacitor?.isNativePlatform?.())
const read=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}}
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}}
function visitor(){let v=read('luxe:pwa-visitor');if(!v){v=crypto.randomUUID();write('luxe:pwa-visitor',v)}return v}
function track(event_type:string,metadata:Record<string,unknown>={}){fetch(COLLECTOR,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brand_key:'luxe-on-demand',event_type,visitor_key:visitor(),metadata:{app:'luxe-on-demand',...metadata}}),keepalive:true}).catch(()=>undefined)}

export default function InstallAppPrompt(){
  const[prompt,setPrompt]=useState<PromptEvent|null>(null)
  const[show,setShow]=useState(false)
  const[steps,setSteps]=useState(false)
  const[apple,setApple]=useState(false)
  useEffect(()=>{
    if(native()||standalone())return
    const isApple=ios();setApple(isApple)
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined)
    const dismissed=Number(read('luxe:pwa-dismissed')||0);const eligible=!dismissed||Date.now()-dismissed>DISMISS_MS
    const before=(e:Event)=>{e.preventDefault();
    if(forceInstall())window.setTimeout(()=>setShow(true),120);setPrompt(e as PromptEvent);if(eligible)setTimeout(()=>setShow(true),1700)}
    const done=()=>{setShow(false);track('app_install',{platform:isApple?'ios':'web',variant:'luxe_pwa'})}
    addEventListener('beforeinstallprompt',before);addEventListener('appinstalled',done)
    let timer=0;if(eligible&&isApple)timer=window.setTimeout(()=>setShow(true),4200)
    return()=>{removeEventListener('beforeinstallprompt',before);removeEventListener('appinstalled',done);if(timer)clearTimeout(timer)}
  },[])
  if(!show)return null
  const close=()=>{write('luxe:pwa-dismissed',String(Date.now()));setShow(false);track('cta_click',{cta:'pwa_prompt_dismiss'})}
  const install=async()=>{track('app_install_click',{platform:apple?'ios':'web',variant:prompt?'native_prompt':'instructions'});if(prompt){const result=await prompt.prompt();setPrompt(null);if(result.outcome==='accepted')setShow(false);return}setSteps(true)}
  return <div className="luxe-install" role="dialog" aria-modal="true" aria-label="Install LUXE On Demand">
    <InstallQr/><section>
    <button className="close" onClick={close} aria-label="Close">×</button>
    <div className="mark"><span>LUXE</span><small>ON DEMAND</small></div>
    {!steps?<div className="copy"><p className="eyebrow">PRIVATE MOBILITY. ALWAYS WITHIN REACH.</p><h2>YOUR DRIVER.<br/><em>ONE TAP</em><br/>AWAY.</h2><p>Add LUXE to your Home Screen for faster access to airport, executive and premium ride requests.</p><button className="primary" onClick={install}>{prompt?'INSTALL LUXE':'ADD LUXE TO HOME SCREEN'} <b>↗</b></button><button className="later" onClick={close}>Continue in browser</button></div>:
    <div className="copy"><p className="eyebrow">{apple?'IPHONE / SAFARI':'INSTALL LUXE'}</p><h2>THREE TAPS.<br/><em>READY.</em></h2><ol><li><b>01</b><span>{apple?'Tap Share in Safari':'Open your browser menu'}</span></li><li><b>02</b><span>Choose Add to Home Screen / Install App</span></li><li><b>03</b><span>Tap Add</span></li></ol><button className="primary" onClick={close}>GOT IT</button></div>}
    <style jsx>{`.luxe-install{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:end center;padding:16px;background:linear-gradient(180deg,#05070a22,#05070ae6);backdrop-filter:blur(10px)}section{position:relative;width:min(650px,100%);overflow:hidden;border:1px solid #dec99e55;border-radius:28px;padding:30px 22px 22px;background:radial-gradient(circle at 88% 5%,#dec99e22,transparent 34%),linear-gradient(145deg,#171d24,#07090c 74%);box-shadow:0 35px 100px #000d;color:#f4f0e7}.close{position:absolute;right:14px;top:14px;width:38px;height:38px;border-radius:50%;border:1px solid #fff2;background:#fff1;color:#fff;font-size:24px}.mark{position:absolute;right:25px;top:72px;width:138px;height:138px;border-radius:28px;border:1px solid #dec99e66;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(145deg,#202831,#0a0d11);box-shadow:0 25px 60px #0009;transform:rotate(5deg)}.mark span{font:900 29px/1 Arial;letter-spacing:-.07em}.mark small{margin-top:8px;color:#dec99e;font:800 8px/1 Arial;letter-spacing:.14em}.copy{max-width:455px;padding-right:115px}.eyebrow{margin:0 0 12px;color:#dec99e;font:900 10px/1 Arial;letter-spacing:.16em}.copy h2{margin:0;font:900 clamp(34px,9vw,54px)/.86 Arial;letter-spacing:-.055em}.copy h2 em{font-style:normal;color:#dec99e}.copy>p:not(.eyebrow){margin:18px 0;color:#c5c7ca;font:500 14px/1.55 Arial}.primary{width:100%;min-height:54px;border:1px solid #dec99e88;border-radius:14px;background:linear-gradient(100deg,#dec99e,#aa8a54);color:#080b10;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font:900 12px/1 Arial;letter-spacing:.05em}.primary b{font-size:21px}.later{width:100%;border:0;background:transparent;color:#9da0a5;padding:13px 0 0;font:700 11px/1 Arial}.copy ol{list-style:none;margin:20px 0;padding:0;display:grid;gap:9px}.copy li{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #fff2;border-radius:13px;background:#fff1}.copy li b{color:#dec99e;font:900 11px/1 Arial}.copy li span{font:700 12px/1.3 Arial}@media(min-width:720px){.luxe-install{place-items:center}section{padding:40px 35px 30px}.copy{padding-right:155px}}@media(max-width:430px){.mark{right:-32px;opacity:.58}.copy{padding-right:40px}.copy h2{font-size:36px}}`}</style>
  </section></div>
}
