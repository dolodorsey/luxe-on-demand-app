"use client";
import React,{useState,useEffect,useCallback} from 'react';

/* ─── Haptic feedback for native iOS ─── */
// @ts-ignore — Capacitor haptics only available in native shell
const tap=async(_style='Medium')=>{try{const mod=await(Function('return import("@capacitor/haptics")')());await mod.Haptics.impact({style:mod.ImpactStyle[_style]||mod.ImpactStyle.Medium});}catch{}};

/* ─── LUXE Dual Theme System ─── */
/* Female: Gold/Rose luxury | Male: Blue/Steel masculine */
/* GOLD TRIM: Universal premium signature — stays gold on both themes */
const GOLD='#C8A96E';
const GOLD_DARK='#A68B4B';
const GOLD_LIGHT='#D4BC8A';
const GOLD_GLOW='rgba(200,169,110,0.25)';

const THEME_FEMALE={
  bg:'#FAF7F4',card:'#FFFFFF',card2:'#F5F0E8',primary:'#1A1A2E',accent:'#C8A96E',accentDark:'#A68B4B',
  secondary:'#B5505A',secondaryLight:'#E8C4C4',green:'#3D9970',greenDark:'#2D7A56',
  white:'#FFFFFF',black:'#1A1A2E',gray:'#6B6B80',grayLight:'#8B8B9E',grayLighter:'#E8E4DF',
  border:'#E8E4DF',text:'#1A1A2E',muted:'#8B8B9E',yellow:'#D4A017',
  red:'#D94F4F',purple:'#9B7DB8',teal:'#7DABB8',orange:'#D4A76A',blue:'#6B7DB5',
  gradient1:'#C8A96E',gradient2:'#B5505A',
  heroIcon:'💎',heroLabel:'LUXE',ctaLabel:'Book a Stylist',
  navAccent:'#C8A96E',stylistAccent:'#B5505A',
  gold:GOLD,goldDark:GOLD_DARK,goldLight:GOLD_LIGHT,goldGlow:GOLD_GLOW,
};
const THEME_MALE={
  bg:'#F0F4F8',card:'#FFFFFF',card2:'#E8EDF3',primary:'#1A2744',accent:'#2B6CB0',accentDark:'#1E4D8C',
  secondary:'#3182CE',secondaryLight:'#BEE3F8',green:'#38A169',greenDark:'#276749',
  white:'#FFFFFF',black:'#1A2744',gray:'#5A6B80',grayLight:'#8B9DB0',grayLighter:'#DAE1E9',
  border:'#D2D9E3',text:'#1A2744',muted:'#7B8FA3',yellow:'#D69E2E',
  red:'#E53E3E',purple:'#6B46C1',teal:'#319795',orange:'#C87533',blue:'#2B6CB0',
  gradient1:'#2B6CB0',gradient2:'#1A365D',
  heroIcon:'🔵',heroLabel:'LUXE',ctaLabel:'Book Now',
  navAccent:'#2B6CB0',stylistAccent:'#3182CE',
  gold:GOLD,goldDark:GOLD_DARK,goldLight:GOLD_LIGHT,goldGlow:GOLD_GLOW,
};
// Default palette — will be overridden by theme context
let C=THEME_FEMALE;

/* ─── Shared inline helpers ─── */
const flex=(dir='row' as any,align='center',justify='center',gap=0):React.CSSProperties=>({display:'flex',flexDirection:dir,alignItems:align,justifyContent:justify,gap});
const btn=(bg:string,color='#fff',extra?:any):React.CSSProperties=>({background:bg,color,border:'none',borderRadius:14,padding:'14px 28px',fontSize:16,fontWeight:700,cursor:'pointer',transition:'all .2s',...extra});
const cardStyle:React.CSSProperties={background:C.card,borderRadius:20,padding:20,border:`1px solid ${C.border}`,boxShadow:'0 2px 8px rgba(26,26,46,0.04)'};
const inputStyle:React.CSSProperties={width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box' as any,fontFamily:"'DM Sans',sans-serif"};
const errText:React.CSSProperties={fontSize:12,color:C.red,marginTop:4};

/* ─── Service Taxonomy (44 services, 8 categories) ─── */
const SERVICE_TAXONOMY=[
  {id:'hair',name:'Hair',icon:'✂️',color:'#C8A96E',count:8,services:[
    {name:'Braids',desc:'Box braids, knotless, cornrows',price:150,eta:'3 hrs',dur:180},
    {name:'Locs',desc:'Starter locs, retwist, faux locs',price:100,eta:'2.5 hrs',dur:150},
    {name:'Silk Press',desc:'Wash, blow dry, flat iron silk press',price:85,eta:'1.5 hrs',dur:90},
    {name:'Sew-In',desc:'Full sew-in with closure or frontal',price:200,eta:'3 hrs',dur:180},
    {name:'Wig Install',desc:'Lace front customization & install',price:175,eta:'2 hrs',dur:120},
    {name:'Color',desc:'Full color, highlights, balayage, vivids',price:120,eta:'2.5 hrs',dur:150},
    {name:'Cut & Style',desc:'Precision cut, trim, layers, styling',price:65,eta:'1 hr',dur:60},
    {name:'Natural Hair',desc:'Twist outs, wash-n-go, treatments',price:75,eta:'1.5 hrs',dur:90},
  ]},
  {id:'nails',name:'Nails',icon:'💅',color:'#B5505A',count:6,services:[
    {name:'Manicure',desc:'Classic or spa manicure',price:35,eta:'45 min',dur:45},
    {name:'Pedicure',desc:'Classic or spa pedicure',price:45,eta:'1 hr',dur:60},
    {name:'Acrylic Full Set',desc:'Full set with shape & polish',price:65,eta:'1.5 hrs',dur:90},
    {name:'Gel Nails',desc:'Gel overlay, gel-X, builder gel',price:55,eta:'1.5 hrs',dur:75},
    {name:'Nail Art',desc:'Custom designs, 3D, chrome, specialty',price:80,eta:'2 hrs',dur:120},
    {name:'Fill / Refill',desc:'Acrylic or gel fill',price:45,eta:'1 hr',dur:60},
  ]},
  {id:'lashes',name:'Lashes',icon:'👁️',color:'#9B7DB8',count:5,services:[
    {name:'Strip Lashes',desc:'Strip lash application & styling',price:25,eta:'20 min',dur:20},
    {name:'Classic Extensions',desc:'Individual classic lash full set',price:150,eta:'2 hrs',dur:120},
    {name:'Volume Extensions',desc:'Volume or mega volume extensions',price:200,eta:'2.5 hrs',dur:150},
    {name:'Lash Lift & Tint',desc:'Lift with optional tint',price:75,eta:'1 hr',dur:60},
    {name:'Extension Fill',desc:'2-3 week fill on extensions',price:85,eta:'1.5 hrs',dur:75},
  ]},
  {id:'makeup',name:'Makeup',icon:'🎨',color:'#E8C4C4',count:5,services:[
    {name:'Full Glam',desc:'Full glam beat — foundation to finish',price:120,eta:'1.5 hrs',dur:90},
    {name:'Natural / Everyday',desc:'Soft glam, no-makeup makeup',price:85,eta:'1 hr',dur:60},
    {name:'Bridal',desc:'Bridal makeup with trial included',price:300,eta:'2 hrs',dur:120},
    {name:'Editorial',desc:'Editorial, photoshoot, creative',price:150,eta:'2 hrs',dur:120},
    {name:'SFX Makeup',desc:'Special effects & prosthetics',price:200,eta:'3 hrs',dur:180},
  ]},
  {id:'skincare',name:'Skincare',icon:'🧖',color:'#7DABB8',count:5,services:[
    {name:'Basic Facial',desc:'Cleansing facial with extraction',price:85,eta:'1 hr',dur:60},
    {name:'Chemical Peel',desc:'Light to medium chemical peel',price:120,eta:'45 min',dur:45},
    {name:'Dermaplaning',desc:'Exfoliation & peach fuzz removal',price:95,eta:'45 min',dur:45},
    {name:'LED Therapy',desc:'LED light therapy treatment',price:75,eta:'30 min',dur:30},
    {name:'HydraFacial',desc:'Deep cleanse, extract, hydrate',price:175,eta:'1 hr',dur:60},
  ]},
  {id:'massage',name:'Massage',icon:'💆',color:'#8BAF7D',count:5,services:[
    {name:'Swedish',desc:'Relaxation full body massage',price:100,eta:'1 hr',dur:60},
    {name:'Deep Tissue',desc:'Targeted deep tissue work',price:120,eta:'1 hr',dur:60},
    {name:'Lymphatic Drainage',desc:'Manual lymphatic drainage',price:130,eta:'1 hr',dur:60},
    {name:'Body Contouring',desc:'Non-invasive body sculpting',price:150,eta:'1.5 hrs',dur:75},
    {name:'Prenatal',desc:'Gentle massage for expecting mothers',price:110,eta:'1 hr',dur:60},
  ]},
  {id:'waxing',name:'Waxing',icon:'✨',color:'#D4A76A',count:5,services:[
    {name:'Eyebrow Wax',desc:'Eyebrow shaping & wax',price:20,eta:'15 min',dur:15},
    {name:'Full Face Wax',desc:'Lip, chin, cheeks, forehead',price:45,eta:'30 min',dur:30},
    {name:'Brazilian',desc:'Full Brazilian wax',price:65,eta:'30 min',dur:30},
    {name:'Full Body Wax',desc:'Complete body waxing package',price:150,eta:'1.5 hrs',dur:90},
    {name:'Leg Wax',desc:'Half or full leg wax',price:55,eta:'45 min',dur:45},
  ]},
  {id:'barber',name:'Barber',icon:'💈',color:'#6B7DB5',count:5,services:[
    {name:'Fade',desc:'Skin fade, taper fade, drop fade',price:35,eta:'30 min',dur:30},
    {name:'Lineup',desc:'Precision edge-up & lineup',price:20,eta:'15 min',dur:15},
    {name:'Beard Trim',desc:'Beard grooming, shaping, lineup',price:25,eta:'20 min',dur:20},
    {name:'Hot Towel Shave',desc:'Straight razor hot towel shave',price:40,eta:'30 min',dur:30},
    {name:'Full Service Cut',desc:'Haircut + beard + lineup package',price:55,eta:'45 min',dur:45},
  ]},
];

const PLANS=[
  {name:'Free',price:'$0',period:'forever',features:['Pay-as-you-go pricing','Standard matching','Basic notifications','Email support'],popular:false},
  {name:'LUXE+',price:'$14.99',period:'/month',features:['15% off all services','Priority matching','Before & after photos','24/7 support','1 free eyebrow wax/month'],popular:true},
  {name:'LUXE VIP',price:'$29.99',period:'/month',features:['25% off all services','VIP priority matching','Dedicated stylist matching','24/7 concierge line','2 free services/month','Family coverage (up to 4)','Personal beauty consultant'],popular:false},
];

const REVIEWS=[
  {text:'My braids came out absolutely perfect. She arrived in 30 minutes and my hair has never looked this good. LUXE is unmatched.',name:'Jasmine R.',plan:'LUXE+ Member',stars:5},
  {text:'I use LUXE for everything — nails, lashes, facials. One app for all my beauty needs. The stylists are elite.',name:'Destiny K.',plan:'VIP Member',stars:5},
  {text:'Got a fade at my apartment before a date. The barber was professional, clean, and fast. This app is a game-changer.',name:'Marcus T.',plan:'LUXE+',stars:5},
];

const STYLIST_HISTORY=[
  {client:'Jasmine R.',service:'Braids',earned:150,time:'2:15 PM',rating:5},
  {client:'Destiny K.',service:'Gel Nails',earned:55,time:'11:30 AM',rating:5},
  {client:'Angela W.',service:'Full Glam',earned:120,time:'9:45 AM',rating:4},
  {client:'Priya M.',service:'Silk Press',earned:85,time:'Yesterday',rating:5},
];

const CLIENT_HISTORY=[
  {service:'Braids',stylist:'Jasmine R.',date:'Today, 2:15 PM',cost:150,status:'Completed'},
  {service:'Gel Nails',stylist:'Nia W.',date:'Mar 15, 9:30 AM',cost:55,status:'Completed'},
  {service:'Full Glam',stylist:'Destiny K.',date:'Feb 28, 7:45 PM',cost:120,status:'Completed'},
];

/* ─── Validation ─── */
const isValidEmail=(e:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordStrength=(p:string)=>{
  if(p.length<8) return{label:'Too short',color:C.red,pct:20};
  let s=0;if(/[a-z]/.test(p))s++;if(/[A-Z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^a-zA-Z0-9]/.test(p))s++;
  if(s<=1)return{label:'Weak',color:C.orange,pct:40};if(s===2)return{label:'Fair',color:C.yellow,pct:60};
  if(s===3)return{label:'Good',color:C.accent,pct:80};return{label:'Strong',color:C.green,pct:100};
};

/* ════════════════════════════════════════ */
/*               MAIN APP                  */
/* ════════════════════════════════════════ */
export default function LuxeApp(){
  const[screen,setScreen]=useState('landing');
  const[fade,setFade]=useState(true);
  const[userName,setUserName]=useState('');
  const[userId,setUserId]=useState('');
  const[gender,setGender]=useState<'male'|'female'|'non_binary'|'prefer_not_to_say'>('female');
  const T=gender==='male'?THEME_MALE:THEME_FEMALE;
  // Update global C reference for helpers that use it
  C=T;  const[isOffline,setIsOffline]=useState(false);

  useEffect(()=>{setIsOffline(!navigator.onLine);const on=()=>setIsOffline(false);const off=()=>setIsOffline(true);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);

  const navigate=useCallback((s:string)=>{setFade(false);setTimeout(()=>{setScreen(s);setFade(true);window.scrollTo(0,0);},200);},[]);

  const wrapper:React.CSSProperties={maxWidth:430,margin:'0 auto',minHeight:'100dvh',background:T.bg,fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",color:T.text,position:'relative',overflow:'hidden',opacity:fade?1:0,transition:'opacity .2s, background .4s'};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800;9..40,900&family=DM+Mono:wght@300;400;500&display=swap');
        @keyframes anim-rise{0%{opacity:0;transform:translateY(24px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes anim-pop{0%{opacity:0;transform:scale(.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes anim-slide-up{0%{opacity:0;transform:translateY(40px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes anim-fade{0%{opacity:0}100%{opacity:1}}
        @keyframes anim-tab{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse-ring{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}
        @keyframes bounce-in{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
        @keyframes luxe-pulse{0%,100%{box-shadow:0 8px 30px ${T.accent}40}50%{box-shadow:0 8px 50px ${T.accent}70}}
        .anim-rise{animation:anim-rise .5s ease-out both}
        .anim-pop{animation:anim-pop .4s cubic-bezier(.34,1.56,.64,1) both}
        .anim-slide-up{animation:anim-slide-up .6s ease-out both}
        .anim-fade{animation:anim-fade .4s ease-out both}
        .anim-tab{animation:anim-tab .35s ease-out both}
        body{margin:0;background:${T.bg};transition:background .4s}
        *{box-sizing:border-box}
      `}</style>
      <div style={wrapper}>
        {isOffline&&<div style={{position:'fixed',top:0,left:0,right:0,zIndex:200,background:T.red,color:'#fff',textAlign:'center',padding:6,fontSize:11,fontWeight:700}}>No internet connection</div>}
        {screen==='landing'&&<Landing T={T} onBook={()=>navigate('auth-client')} onStylistPortal={()=>navigate('auth-stylist')}/>}
        {screen==='auth-client'&&<AuthScreen T={T} role="client" gender={gender} setGender={setGender} onBack={()=>navigate('landing')} onLogin={(n,id)=>{setUserName(n);setUserId(id);navigate('client');}}/>}
        {screen==='auth-stylist'&&<AuthScreen T={T} role="stylist" gender={gender} setGender={setGender} onBack={()=>navigate('landing')} onLogin={(n,id)=>{setUserName(n);setUserId(id);navigate('stylist');}}/>}
        {screen==='client'&&<ClientApp T={T} userName={userName} userId={userId} onBack={()=>{setUserName('');setUserId('');navigate('landing');}}/>}
        {screen==='stylist'&&<StylistDashboard T={T} userName={userName} userId={userId} onBack={()=>{setUserName('');setUserId('');navigate('landing');}}/>}
      </div>
    </>
  );
}

/* ════════════════════════════════════════ */
/*          AUTH SCREEN                    */
/* ════════════════════════════════════════ */
const AuthScreen=({T,role,gender,setGender,onBack,onLogin}:{T:typeof THEME_FEMALE;role:string;gender:string;setGender:(g:any)=>void;onBack:()=>void;onLogin:(n:string,id:string)=>void})=>{
  const[mode,setMode]=useState('signin');
  const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[name,setName]=useState('');
  const[touched,setTouched]=useState<any>({});const[loading,setLoading]=useState(false);const[authError,setAuthError]=useState('');

  const isClient=role==='client';
  const accent=T.accent;
  const title=isClient?'Your Account':'Stylist Portal';
  const subtitle=isClient?'Book premium beauty services':'Join the LUXE network';
  const icon=isClient?(gender==='male'?'🔵':'💎'):'✂️';

  const emailErr=touched.email&&!isValidEmail(email)?'Enter a valid email':'';
  const pwErr=touched.password&&password.length>0&&password.length<8?'Min 8 characters':'';
  const nameErr=touched.name&&mode==='signup'&&name.trim().length<2?'Min 2 characters':'';
  const pwInfo=password.length>0?passwordStrength(password):null;
  const isValid=isValidEmail(email)&&password.length>=8&&(mode==='signin'||name.trim().length>=2);

  const handleSubmit=async()=>{
    if(!isValid||loading)return;setLoading(true);setAuthError('');
    try{
      // Demo mode — bypass auth for now
      const displayName=name.trim()||email.split('@')[0]||'User';
      onLogin(displayName,'demo-user-id');
    }catch(err:any){
      let msg=err.message||'Authentication failed';
      if(msg.includes('Invalid login'))msg='Invalid email or password';
      if(msg.includes('already registered'))msg='Already registered. Try signing in.';
      setAuthError(msg);
    }finally{setLoading(false);}
  };

  return(
    <div style={{minHeight:'100dvh',background:T.bg,...flex('column','stretch','flex-start'),transition:'background .4s'}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',color:T.gray,fontSize:14,cursor:'pointer',fontWeight:600}}>← Back</button>
        <div style={{fontWeight:800,fontSize:16,color:T.text,letterSpacing:1,fontFamily:"'Cormorant Garamond',serif"}}>LUXE</div>
        <div style={{width:50}}/>
      </div>
      <div style={{flex:1,...flex('column','center','center'),padding:'40px 24px'}}>
        <div style={{width:80,height:80,borderRadius:20,background:`${accent}12`,...flex('row','center','center'),fontSize:40,marginBottom:20,transition:'background .4s'}}>{icon}</div>
        <h1 style={{fontSize:24,fontWeight:800,color:T.text,margin:'0 0 4px',fontFamily:"'Cormorant Garamond',serif"}}>{title}</h1>
        <p style={{fontSize:14,color:T.muted,margin:'0 0 32px'}}>{subtitle}</p>

        <div style={{...flex('row','center','center',0),width:'100%',marginBottom:28,background:T.card2,borderRadius:12,padding:4,border:`1px solid ${T.border}`,transition:'all .4s'}}>
          <button onClick={()=>{setMode('signin');setTouched({});}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,background:mode==='signin'?accent:'transparent',color:mode==='signin'?T.white:T.muted,transition:'all .2s'}}>Sign In</button>
          <button onClick={()=>{setMode('signup');setTouched({});}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,background:mode==='signup'?accent:'transparent',color:mode==='signup'?T.white:T.muted,transition:'all .2s'}}>Create Account</button>
        </div>

        <div style={{width:'100%',maxWidth:360}}>
          {mode==='signup'&&<>
            <div style={{marginBottom:16}}><label style={{fontSize:12,color:T.gray,fontWeight:600,marginBottom:6,display:'block'}}>Full Name</label><input value={name} onChange={e=>setName(e.target.value)} onBlur={()=>setTouched((t:any)=>({...t,name:true}))} placeholder="Enter your full name" style={{...inputStyle,background:T.card2,borderColor:nameErr?T.red:T.border,color:T.text}}/>{nameErr&&<div style={errText}>{nameErr}</div>}</div>
            {/* GENDER SELECTOR */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:T.gray,fontWeight:600,marginBottom:8,display:'block'}}>I am</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {([['female','👩','Female'],['male','👨','Male']] as const).map(([val,emoji,label])=>(
                  <button key={val} onClick={()=>setGender(val)} style={{padding:'14px 12px',borderRadius:14,border:`2px solid ${gender===val?T.accent:T.border}`,background:gender===val?`${T.accent}10`:T.card,cursor:'pointer',transition:'all .3s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <span style={{fontSize:20}}>{emoji}</span>
                    <span style={{fontSize:14,fontWeight:gender===val?700:500,color:gender===val?T.accent:T.muted}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>}
          <div style={{marginBottom:16}}><label style={{fontSize:12,color:T.gray,fontWeight:600,marginBottom:6,display:'block'}}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>setTouched((t:any)=>({...t,email:true}))} placeholder="you@example.com" style={{...inputStyle,background:T.card2,borderColor:emailErr?T.red:T.border,color:T.text}}/>{emailErr&&<div style={errText}>{emailErr}</div>}</div>
          <div style={{marginBottom:8}}><label style={{fontSize:12,color:T.gray,fontWeight:600,marginBottom:6,display:'block'}}>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>setTouched((t:any)=>({...t,password:true}))} placeholder="••••••••" style={{...inputStyle,background:T.card2,borderColor:pwErr?T.red:T.border,color:T.text}}/>{pwErr&&<div style={errText}>{pwErr}</div>}</div>
          {pwInfo&&<div style={{marginBottom:20}}><div style={{height:4,background:T.grayLighter,borderRadius:2,overflow:'hidden',marginBottom:4}}><div style={{height:'100%',width:`${pwInfo.pct}%`,background:pwInfo.color,borderRadius:2,transition:'all .3s'}}/></div><div style={{fontSize:11,color:pwInfo.color,fontWeight:600}}>{pwInfo.label}</div></div>}
          {!pwInfo&&<div style={{height:16,marginBottom:8}}/>}
          {authError&&<div style={{background:`${T.red}10`,border:`1px solid ${T.red}30`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:T.red}}>{authError}</div>}
          <button onClick={handleSubmit} disabled={!isValid||loading} style={{...btn(isValid?`linear-gradient(135deg, ${T.accent}, ${T.secondary})`:T.grayLighter,isValid?T.white:T.muted),width:'100%',opacity:loading?0.7:1,fontSize:16,borderRadius:14}}>{loading?'Signing in...':mode==='signup'?'Create Account':'Sign In'}</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*             LANDING PAGE               */
/* ════════════════════════════════════════ */
const Landing=({T,onBook,onStylistPortal}:{T:typeof THEME_FEMALE;onBook:()=>void;onStylistPortal:()=>void})=>{
  return(
    <div style={{minHeight:'100dvh',background:T.bg,transition:'background .4s'}}>
      {/* Header with gold trim bottom */}
      <div style={{padding:'16px 24px',...flex('row','center','space-between'),borderBottom:`1px solid ${GOLD}20`}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:22,color:GOLD,letterSpacing:3,textShadow:`0 0 20px ${GOLD}15`}}>LUXE</div>
        <button onClick={onBook} style={{...btn(GOLD,C.white,{padding:'10px 24px',fontSize:13,borderRadius:12,boxShadow:`0 2px 8px ${GOLD_GLOW}`})}}>Get Started</button>
      </div>

      {/* Hero */}
      <section style={{padding:'48px 24px 40px',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16,animation:'float 3s ease-in-out infinite'}}>💎</div>
        <h1 style={{fontSize:32,fontWeight:300,color:C.text,margin:'0 0 8px',lineHeight:1.2,fontFamily:"'Cormorant Garamond',serif"}}>Premium Beauty,<br/><span style={{fontWeight:700,background:`linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>On Demand.</span></h1>
        <p style={{fontSize:15,color:C.gray,margin:'0 0 32px',lineHeight:1.6,maxWidth:320,marginLeft:'auto',marginRight:'auto'}}>Book elite stylists for hair, nails, lashes, makeup, skincare, massage, waxing & barber — at your door or their studio.</p>
        <button onClick={onBook} style={{...btn(`linear-gradient(135deg, ${C.accent}, ${C.secondary})`),fontSize:17,padding:'16px 48px',boxShadow:`0 8px 30px ${C.accent}30`,borderRadius:16,border:`1px solid ${GOLD}30`}}>Book a Stylist</button>
      </section>

      {/* Services Grid — gold trim divider */}
      <section style={{padding:'40px 24px',borderTop:`1.5px solid ${GOLD}25`}}>
        <h2 style={{fontSize:24,fontWeight:700,textAlign:'center',color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>292 Services, 13 Categories</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Everything beauty in one place</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {SERVICE_TAXONOMY.map((cat,i)=>(
            <div key={cat.id} className="anim-pop" style={{...cardStyle,textAlign:'center',padding:20,animationDelay:`${i*0.08}s`,borderLeft:`3px solid ${cat.color}`}}>
              <div style={{fontSize:32,marginBottom:8}}>{cat.icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>{cat.name}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{cat.count} services</div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Safety */}
      <section style={{padding:'48px 24px',borderTop:`1.5px solid ${GOLD}25`}}>
        <h2 style={{fontSize:24,fontWeight:700,textAlign:'center',color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>Trust & Safety Built In</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Every stylist is licensed, verified & background checked</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[{icon:'🛡️',title:'Licensed & Verified',desc:'Cosmetology license verified on file'},{icon:'⭐',title:'Portfolio Reviewed',desc:'Before & after photos required'},{icon:'📍',title:'Live Tracking',desc:'Real-time session tracking for safety'},{icon:'📞',title:'24/7 Support',desc:'Always available when you need us'}].map(c=>(
            <div key={c.title} style={{...cardStyle,textAlign:'center',padding:20}}>
              <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>{c.title}</div>
              <div style={{fontSize:11,color:C.gray,lineHeight:1.4}}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section style={{padding:'48px 24px',borderTop:`1.5px solid ${GOLD}25`}}>
        <h2 style={{fontSize:24,fontWeight:700,textAlign:'center',color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>Choose Your Plan</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Save more with a membership</p>
        {PLANS.map(p=>(
          <div key={p.name} style={{...cardStyle,marginBottom:16,border:`1px solid ${p.popular?C.accent:C.border}`,position:'relative',overflow:'hidden'}}>
            {p.popular&&<div style={{position:'absolute',top:12,right:-30,background:`linear-gradient(135deg, ${C.accent}, ${C.secondary})`,color:C.white,fontSize:10,fontWeight:800,padding:'4px 36px',transform:'rotate(45deg)',letterSpacing:1}}>POPULAR</div>}
            <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>{p.name}</div>
            <div style={{...flex('row','baseline','flex-start',4),marginBottom:12}}><span style={{fontSize:32,fontWeight:900,color:p.popular?C.accent:C.text}}>{p.price}</span><span style={{fontSize:13,color:C.muted}}>{p.period}</span></div>
            {p.features.map(f=>(<div key={f} style={{...flex('row','center','flex-start',8),marginBottom:8}}><span style={{color:C.green,fontSize:14}}>✓</span><span style={{fontSize:13,color:C.gray}}>{f}</span></div>))}
            <button onClick={onBook} style={{...btn(p.popular?`linear-gradient(135deg, ${C.accent}, ${C.secondary})`:C.card2,p.popular?C.white:C.text,{width:'100%',marginTop:12,border:p.popular?'none':`1px solid ${C.border}`})}}>{p.price==='$0'?'Get Started Free':'Subscribe Now'}</button>
          </div>
        ))}
      </section>

      {/* Testimonials */}
      <section style={{padding:'48px 24px',borderTop:`1.5px solid ${GOLD}25`}}>
        <h2 style={{fontSize:24,fontWeight:700,textAlign:'center',color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>What People Say</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Real reviews from real clients</p>
        {REVIEWS.map((r,i)=>(<div key={i} style={{...cardStyle,marginBottom:16}}><div style={{marginBottom:8,color:C.yellow}}>{'★'.repeat(r.stars)}</div><p style={{fontSize:14,color:C.gray,lineHeight:1.6,margin:'0 0 12px',fontStyle:'italic'}}>"{r.text}"</p><div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>{r.plan}</div></div>))}
      </section>

      {/* Become a Stylist */}
      <section style={{padding:'48px 24px',borderTop:`1.5px solid ${GOLD}25`,textAlign:'center',background:`radial-gradient(ellipse at 50% 100%,${C.accent}08 0%,transparent 60%)`}}>
        <div style={{fontSize:48,marginBottom:16}}>✂️</div>
        <h2 style={{fontSize:24,fontWeight:700,color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>Become a LUXE Stylist</h2>
        <p style={{fontSize:14,color:C.gray,margin:'0 0 24px',maxWidth:320,marginLeft:'auto',marginRight:'auto',lineHeight:1.6}}>Earn on your schedule doing what you love. Set your own rates, build your clientele, and get paid instantly.</p>
        <button onClick={onStylistPortal} style={{...btn(C.secondary),fontSize:16,padding:'14px 40px',borderRadius:16}}>Apply Now</button>
      </section>

      {/* Stats */}
      <section style={{padding:'40px 24px',borderTop:`1.5px solid ${GOLD}25`}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {[['44+','Services'],['4.9','App Rating'],['30 min','Avg Arrival'],['100%','Licensed']].map(([val,label])=>(
            <div key={label} style={{textAlign:'center'}}><div style={{fontSize:24,fontWeight:900,color:C.text}}>{val}</div><div style={{fontSize:11,color:C.muted}}>{label}</div></div>
          ))}
        </div>
      </section>

      <footer style={{padding:'32px 24px',borderTop:`1.5px solid ${GOLD}25`,textAlign:'center'}}>
        <div style={{fontWeight:700,fontSize:18,color:GOLD,marginBottom:4,fontFamily:"'Cormorant Garamond',serif",letterSpacing:3}}>LUXE ON DEMAND</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Premium Beauty. Your Schedule.</div>
        <div style={{width:40,height:1,background:`linear-gradient(90deg, transparent, ${GOLD}, transparent)`,margin:'0 auto 12px'}}/>
        <div style={{fontSize:11,color:C.grayLight}}>© 2026 LUXE On Demand. All rights reserved.</div>
      </footer>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*            CLIENT APP                   */
/* ════════════════════════════════════════ */
const ClientApp=({T,userName,userId,onBack}:{T:typeof THEME_FEMALE;userName:string;userId:string;onBack:()=>void})=>{
  const[tab,setTab]=useState('home');
  const[selectedService,setSelectedService]=useState<any>(null);
  const[reqStep,setReqStep]=useState<string|null>(null);
  const[eta,setEta]=useState(1800);
  const[notifOpen,setNotifOpen]=useState(false);
  const[serviceMode,setServiceMode]=useState<'mobile'|'in_studio'>('mobile');

  useEffect(()=>{if(reqStep!=='tracking')return;const t=setInterval(()=>setEta(p=>Math.max(0,p-1)),1000);return()=>clearInterval(t);},[reqStep]);

  const startRequest=(svc:any)=>{tap();setSelectedService(svc);setReqStep('confirm');};

  const dispatchStylist=async()=>{tap('Heavy');setReqStep('finding');setTimeout(()=>setReqStep('found'),3000);};
  const startTracking=()=>{setEta(1800);setReqStep('tracking');};
  const cancelRequest=()=>{setReqStep(null);setSelectedService(null);};
  const formatEta=(s:number)=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  /* ── Confirm Screen ── */
  if(reqStep==='confirm'&&selectedService) return(
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}><button onClick={cancelRequest} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600}}>← Cancel</button><div style={{fontSize:14,fontWeight:700,color:C.text}}>Confirm Booking</div><div style={{width:50}}/></div>
      <div style={{flex:1,...flex('column','center','center'),padding:'40px 24px'}}>
        <div style={{width:100,height:100,borderRadius:24,background:`${C.accent}12`,...flex('row','center','center'),fontSize:48,marginBottom:20}}>💎</div>
        <h2 style={{fontSize:28,fontWeight:700,color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>{selectedService.name}</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:24}}>{selectedService.desc}</p>

        {/* Mode Toggle */}
        <div style={{...flex('row','center','center',0),width:'100%',marginBottom:20,background:C.card2,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
          <button onClick={()=>setServiceMode('mobile')} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,background:serviceMode==='mobile'?C.accent:'transparent',color:serviceMode==='mobile'?C.white:C.muted,transition:'all .2s'}}>📍 Mobile (Come to Me)</button>
          <button onClick={()=>setServiceMode('in_studio')} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,background:serviceMode==='in_studio'?C.accent:'transparent',color:serviceMode==='in_studio'?C.white:C.muted,transition:'all .2s'}}>🏠 In-Studio</button>
        </div>

        <div style={{...cardStyle,width:'100%',marginBottom:24}}>
          <div style={{...flex('row','center','space-between'),marginBottom:12}}><span style={{fontSize:14,color:C.gray}}>Service Price</span><span style={{fontSize:20,fontWeight:900,color:C.accent}}>${selectedService.price}</span></div>
          <div style={{...flex('row','center','space-between'),marginBottom:12}}><span style={{fontSize:14,color:C.gray}}>Duration</span><span style={{fontSize:16,fontWeight:700,color:C.text}}>~{selectedService.eta}</span></div>
          <div style={{...flex('row','center','space-between'),marginBottom:12}}><span style={{fontSize:14,color:C.gray}}>Service Mode</span><span style={{fontSize:14,fontWeight:600,color:serviceMode==='mobile'?C.green:C.accent}}>{serviceMode==='mobile'?'📍 Mobile':'🏠 In-Studio'}</span></div>
          <div style={{...flex('row','center','space-between')}}><span style={{fontSize:14,color:C.gray}}>Platform Fee</span><span style={{fontSize:14,fontWeight:600,color:C.muted}}>$0.00</span></div>
        </div>

        {serviceMode==='mobile'&&<div style={{width:'100%',padding:'16px 20px',background:`${C.accent}08`,borderRadius:14,marginBottom:24,...flex('row','center','flex-start',10)}}><span style={{fontSize:18}}>📍</span><div><div style={{fontSize:13,fontWeight:600,color:C.text}}>Your current location</div><div style={{fontSize:11,color:C.muted}}>GPS detected automatically</div></div></div>}

        <button onClick={dispatchStylist} style={{...btn(`linear-gradient(135deg, ${C.accent}, ${C.secondary})`),width:'100%',fontSize:18,padding:'18px 32px',boxShadow:`0 8px 30px ${C.accent}25`,borderRadius:16}}>💎 Find My Stylist</button>
      </div>
    </div>
  );

  /* ── Finding Screen ── */
  if(reqStep==='finding') return(
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','center','center'),padding:40}}>
      <div style={{position:'relative',width:160,height:160,marginBottom:40}}>
        <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`2px solid ${C.accent}30`,animation:'pulse-ring 2s ease-out infinite'}}/>
        <div style={{position:'absolute',inset:20,borderRadius:'50%',border:`2px solid ${C.accent}50`,animation:'pulse-ring 2s ease-out infinite .5s'}}/>
        <div style={{position:'absolute',inset:40,borderRadius:'50%',border:`2px solid ${C.accent}80`,animation:'pulse-ring 2s ease-out infinite 1s'}}/>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg, ${C.accent}, ${C.secondary})`,boxShadow:`0 0 30px ${C.accent}40`,...flex('row','center','center')}}><span style={{fontSize:20}}>✨</span></div>
      </div>
      <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:8,fontFamily:"'Cormorant Garamond',serif"}}>Finding Your Stylist...</div>
      <div style={{fontSize:14,color:C.gray,textAlign:'center'}}>Matching you with the closest verified professional</div>
    </div>
  );

  /* ── Found Screen ── */
  if(reqStep==='found') return(
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','center','center'),padding:24}}>
      <div style={{fontSize:48,marginBottom:16,animation:'bounce-in .5s ease'}}>🎉</div>
      <h2 style={{fontSize:24,fontWeight:700,color:C.text,margin:'0 0 8px',fontFamily:"'Cormorant Garamond',serif"}}>Stylist Matched!</h2>
      <p style={{fontSize:14,color:C.gray,margin:'0 0 24px'}}>{serviceMode==='mobile'?'On the way to you':'Your appointment is confirmed'}</p>
      <div style={{...cardStyle,width:'100%',maxWidth:360}}>
        <div style={{...flex('row','center','flex-start',16),marginBottom:20}}>
          <div style={{width:64,height:64,borderRadius:16,background:`${C.accent}12`,...flex('row','center','center'),fontSize:32}}>✂️</div>
          <div><div style={{fontSize:20,fontWeight:800,color:C.text}}>Jasmine R.</div><div style={{fontSize:13,color:C.yellow}}>★ 4.9 · 247 bookings</div><div style={{display:'inline-block',marginTop:4,padding:'2px 10px',borderRadius:100,background:`${C.secondary}15`,color:C.secondary,fontSize:10,fontWeight:700,letterSpacing:0.5}}>ELITE</div></div>
        </div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1.5px solid ${GOLD}25`}}><span style={{fontSize:13,color:C.gray}}>ETA</span><span style={{fontSize:16,fontWeight:700,color:C.text}}>~30 min</span></div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1.5px solid ${GOLD}25`}}><span style={{fontSize:13,color:C.gray}}>Service</span><span style={{fontSize:13,fontWeight:600,color:C.text}}>{selectedService?.name}</span></div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1.5px solid ${GOLD}25`}}><span style={{fontSize:13,color:C.gray}}>Mode</span><span style={{fontSize:13,fontWeight:600,color:serviceMode==='mobile'?C.green:C.accent}}>{serviceMode==='mobile'?'📍 Coming to you':'🏠 At studio'}</span></div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1.5px solid ${GOLD}25`}}><span style={{fontSize:13,color:C.gray}}>Price</span><span style={{fontSize:16,fontWeight:800,color:C.accent}}>${selectedService?.price}</span></div>
      </div>
      <button onClick={startTracking} style={{...btn(C.green),width:'100%',maxWidth:360,fontSize:16,marginTop:24,borderRadius:16}}>Track My Stylist →</button>
    </div>
  );

  /* ── Tracking Screen ── */
  if(reqStep==='tracking') return(
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}><button onClick={cancelRequest} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600}}>← Back</button><div style={{fontSize:14,fontWeight:700,color:C.text}}>Live Tracking</div><div style={{width:50}}/></div>
      {/* Map */}
      <div style={{margin:'0 20px',height:220,background:C.card,borderRadius:20,position:'relative',overflow:'hidden',border:`1px solid ${C.border}`}}>
        <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 50%,${C.card2} 0%,${C.bg} 100%)`}}/>
        <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.5}}/>
        <div style={{position:'absolute',top:'35%',left:'35%',width:14,height:14,borderRadius:'50%',background:C.accent,boxShadow:`0 0 20px ${C.accent}60`,animation:'float 2s ease-in-out infinite'}}/>
        <div style={{position:'absolute',top:'55%',left:'55%',width:14,height:14,borderRadius:'50%',background:C.green,boxShadow:`0 0 20px ${C.green}60`}}/>
        <div style={{position:'absolute',bottom:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>🟢 Stylist en route</div>
      </div>
      {/* Timer */}
      <div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Estimated Arrival</div><div style={{fontSize:48,fontWeight:900,color:C.accent,fontFamily:"'DM Mono',monospace"}}>{formatEta(eta)}</div></div>
      {/* Stylist Card */}
      <div style={{margin:'0 20px',...cardStyle,...flex('row','center','space-between')}}>
        <div style={flex('row','center','flex-start',12)}><div style={{width:48,height:48,borderRadius:14,background:`${C.accent}12`,...flex('row','center','center'),fontSize:24}}>✂️</div><div><div style={{fontSize:15,fontWeight:700,color:C.text}}>Jasmine R.</div><div style={{fontSize:12,color:C.green}}>En route · {selectedService?.name}</div></div></div>
        <div style={flex('row','center','center',8)}><button style={{width:40,height:40,borderRadius:12,background:`${C.green}12`,border:'none',cursor:'pointer',fontSize:18}}>💬</button><button style={{width:40,height:40,borderRadius:12,background:`${C.accent}12`,border:'none',cursor:'pointer',fontSize:18}}>📞</button></div>
      </div>
      <div style={{padding:'16px 20px',textAlign:'center'}}><button onClick={cancelRequest} style={{...btn('transparent',C.red,{border:`1px solid ${C.red}30`,fontSize:14})}}>Cancel Booking</button></div>
    </div>
  );

  /* ── Services Drill-Down ── */
  const ServicesScreen=({onDispatch}:{onDispatch:(svc:any)=>void})=>{
    const[activeCat,setActiveCat]=useState<string|null>(null);
    const[selectedSvc,setSelectedSvc]=useState<string|null>(null);
    const cat=activeCat?SERVICE_TAXONOMY.find(c=>c.id===activeCat):null;

    if(cat){return(
      <div className="anim-tab" style={{padding:20}}>
        <button onClick={()=>{setActiveCat(null);setSelectedSvc(null);}} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',...flex('row','center','flex-start',6),marginBottom:16,fontSize:14}}><span style={{fontSize:18}}>‹</span> All Services</button>
        <div style={{...flex('row','center','flex-start',10),marginBottom:20}}><div style={{width:44,height:44,borderRadius:14,background:`${cat.color}10`,...flex('row','center','center'),fontSize:24}}>{cat.icon}</div><div><div style={{fontSize:18,fontWeight:800,color:C.text}}>{cat.name}</div><div style={{fontSize:12,color:C.muted}}>{cat.services.length} services</div></div></div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {cat.services.map((s,i)=>{const sel=selectedSvc===s.name;return(
            <button key={s.name} className="anim-rise" onClick={()=>setSelectedSvc(sel?null:s.name)} style={{...cardStyle,textAlign:'left' as any,cursor:'pointer',border:sel?`2px solid ${cat.color}`:`1px solid ${C.border}`,animationDelay:`${i*0.05}s`,transition:'all .2s'}}>
              <div style={flex('row','center','space-between')}><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.desc}</div></div><div style={{textAlign:'right' as any,marginLeft:12,flexShrink:0}}><div style={{fontSize:14,fontWeight:800,color:C.accent}}>${s.price}</div><div style={{fontSize:11,color:C.muted}}>⏱ {s.eta}</div></div></div>
            </button>
          );})}
        </div>
        {selectedSvc&&<button onClick={()=>onDispatch(cat.services.find(s2=>s2.name===selectedSvc)||cat.services[0])} className="anim-pop" style={{...btn(`linear-gradient(135deg, ${C.accent}, ${C.secondary})`,C.white,{width:'100%',marginTop:20,padding:'16px 28px',fontSize:15,letterSpacing:0.5,borderRadius:16,boxShadow:`0 8px 30px ${C.accent}25`})}}>💎 BOOK NOW</button>}
      </div>
    );}

    return(
      <div className="anim-tab" style={{padding:20}}>
        <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>All Services</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:20}}>44 services across 8 categories</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {SERVICE_TAXONOMY.map((cat,i)=>(
            <button key={cat.id} className="anim-pop" onClick={()=>setActiveCat(cat.id)} style={{...cardStyle,textAlign:'left' as any,cursor:'pointer',borderLeft:`3px solid ${cat.color}`,animationDelay:`${i*0.06}s`}}>
              <div style={{fontSize:28,marginBottom:8}}>{cat.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{cat.name}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{cat.count} services</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ── Main Client Tabs ── */
  return(
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80,transition:'background .4s'}}>
      {/* Header — GOLD TRIM */}
      <div style={{padding:'16px 20px',...flex('row','center','space-between'),borderBottom:`1px solid ${GOLD}18`}}>
        <div style={flex('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,border:`1px solid ${GOLD}60`,...flex('row','center','center'),fontWeight:900,fontSize:8,color:C.white,letterSpacing:0.3,fontFamily:"'Cormorant Garamond',serif",boxShadow:`0 2px 8px ${GOLD_GLOW}`}}>LX</div>
          <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>Hi, {userName||'there'} 💎</div><div style={{fontSize:11,color:GOLD}}>Free Member</div></div>
        </div>
        <button onClick={()=>setNotifOpen(!notifOpen)} style={{background:C.card,border:`1px solid ${GOLD}25`,borderRadius:12,width:40,height:40,cursor:'pointer',...flex('row','center','center'),position:'relative',boxShadow:`0 1px 6px ${GOLD_GLOW}`}}><span style={{fontSize:18}}>🔔</span><div style={{position:'absolute',top:6,right:6,width:8,height:8,borderRadius:'50%',background:GOLD}}/></button>
      </div>

      {notifOpen&&<div style={{margin:'0 20px 16px',padding:16,background:C.card,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}><div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Notifications</div>{['💎 Welcome to LUXE! Your account is ready.','⭐ Upgrade to LUXE+ for priority matching.'].map((n,i)=>(<div key={i} style={{padding:'10px 0',borderBottom:i===0?`1px solid ${C.border}`:'none',fontSize:13,color:C.gray}}>{n}</div>))}</div>}

      {tab==='home'&&(
        <div className="anim-tab">
          {/* Map */}
          <div style={{margin:'0 20px',height:200,background:C.card,borderRadius:20,position:'relative',overflow:'hidden',...flex('column','center','center'),border:`1px solid ${C.border}`}}>
            <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 50%,${C.card2} 0%,${C.bg} 100%)`}}/>
            <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.5}}/>
            <div style={{position:'relative',width:16,height:16,borderRadius:'50%',background:C.accent,boxShadow:`0 0 20px ${C.accent}60`}}/>
            <div style={{position:'absolute',bottom:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>📍 Your location</div>
          </div>

          {/* Main CTA */}
          <div style={{...flex('column','center','center'),padding:'20px 20px 12px'}}>
            <button onClick={()=>setTab('services')} style={{width:140,height:140,borderRadius:'50%',background:`linear-gradient(135deg, ${C.accent}, ${C.secondary})`,border:'none',color:C.white,fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:`0 8px 40px ${C.accent}35`,letterSpacing:0.5,animation:'luxe-pulse 2s ease-in-out infinite',fontFamily:"'Cormorant Garamond',serif"}}>💎<br/>LUXE<br/><span style={{fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Book Now</span></button>
          </div>

          {/* Quick services */}
          <div style={{padding:'8px 20px'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12}}>Popular Services</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {SERVICE_TAXONOMY.slice(0,6).map((cat,i)=>(
                <button key={cat.id} className="anim-pop" onClick={()=>{setTab('services');}} style={{...cardStyle,textAlign:'center' as any,padding:16,cursor:'pointer',animationDelay:`${i*0.06}s`}}>
                  <div style={{fontSize:28,marginBottom:6}}>{cat.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{cat.name}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>from ${Math.min(...cat.services.map(s=>s.price))}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent */}
          <div style={{padding:'16px 20px'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12}}>Recent Bookings</div>
            {CLIENT_HISTORY.length===0?<div style={{...cardStyle,textAlign:'center' as any,padding:'24px 20px'}}><div style={{fontSize:28,marginBottom:8}}>✨</div><div style={{fontSize:13,color:C.muted}}>No bookings yet. Book your first service!</div></div>:
            CLIENT_HISTORY.map((h,i)=>(
              <div key={i} style={{...cardStyle,...flex('row','center','space-between'),marginBottom:10}}>
                <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{h.service}</div><div style={{fontSize:12,color:C.muted}}>{h.stylist} · {h.date}</div></div>
                <div style={{textAlign:'right' as any}}><div style={{fontSize:16,fontWeight:800,color:C.accent}}>${h.cost}</div><div style={{fontSize:10,fontWeight:600,color:h.status==='Completed'?C.green:C.orange}}>{h.status}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='services'&&<ServicesScreen onDispatch={startRequest}/>}

      {tab==='activity'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Booking History</h2>
          {CLIENT_HISTORY.map((h,i)=>(
            <div key={i} style={{...cardStyle,...flex('row','center','space-between'),marginBottom:12}}>
              <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{h.service}</div><div style={{fontSize:12,color:C.muted}}>{h.stylist} · {h.date}</div></div>
              <div style={{textAlign:'right' as any}}><div style={{fontSize:18,fontWeight:800,color:C.accent}}>${h.cost}</div><div style={{fontSize:10,fontWeight:600,color:C.green}}>{h.status}</div></div>
            </div>
          ))}
        </div>
      )}

      {tab==='profile'&&(
        <div className="anim-tab" style={{padding:20,...flex('column','center','center'),minHeight:'60vh'}}>
          <div style={{width:80,height:80,borderRadius:20,background:`${C.accent}12`,...flex('row','center','center'),fontSize:36,marginBottom:16}}>💎</div>
          <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{userName||'User'}</div>
          <div style={{fontSize:13,color:C.accent,marginBottom:24}}>Free Member</div>
          {['My Profile','Payment Methods','Favorites','Membership','Help & Support'].map(item=>(
            <div key={item} style={{...cardStyle,width:'100%',marginBottom:8,...flex('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}>
              <span style={{fontSize:14,color:C.text}}>{item}</span><span style={{color:C.muted}}>→</span>
            </div>
          ))}
          <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:16})}}>Sign Out</button>
        </div>
      )}

      {/* Bottom Nav — GOLD TRIM */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px) saturate(180%)',WebkitBackdropFilter:'blur(20px) saturate(180%)',borderTop:`1.5px solid ${GOLD}35`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...flex('row','center','space-around'),zIndex:40,boxShadow:`0 -2px 12px ${GOLD_GLOW}`}}>
        {([['home','🏠','Home'],['services','✨','Services'],['activity','📋','Activity'],['profile','👤','Profile']] as const).map(([id,ic,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...flex('column','center','center',2),padding:'6px 12px'}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,color:tab===id?C.accent:C.muted,fontWeight:tab===id?700:500}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*         STYLIST DASHBOARD              */
/* ════════════════════════════════════════ */
const StylistDashboard=({T,userName,userId,onBack}:{T:typeof THEME_FEMALE;userName:string;userId:string;onBack:()=>void})=>{
  const[tab,setTab]=useState('dashboard');
  const[onDuty,setOnDuty]=useState(false);

  const todayEarnings=STYLIST_HISTORY.filter(m=>m.time!=='Yesterday').reduce((s,m)=>s+m.earned,0);
  const weekEarnings=STYLIST_HISTORY.reduce((s,m)=>s+m.earned,0);

  return(
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80,transition:'background .4s'}}>
      {/* Header — GOLD TRIM */}
      <div style={{padding:'16px 20px',...flex('row','center','space-between'),borderBottom:`1px solid ${GOLD}18`}}>
        <div style={flex('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,border:`1px solid ${GOLD}60`,...flex('row','center','center'),fontWeight:900,fontSize:8,color:C.white,letterSpacing:0.3,fontFamily:"'Cormorant Garamond',serif",boxShadow:`0 2px 8px ${GOLD_GLOW}`}}>LX</div>
          <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>Stylist Portal</div><div style={{fontSize:11,color:onDuty?C.green:C.muted}}>{onDuty?'🟢 On Duty':'⚫ Off Duty'}</div></div>
        </div>
        <div style={{width:36,height:36,borderRadius:10,background:`${GOLD}12`,border:`1px solid ${GOLD}25`,...flex('row','center','center'),fontSize:18}}>✂️</div>
      </div>

      {tab==='dashboard'&&(
        <div className="anim-tab" style={{padding:20}}>
          <div style={{...cardStyle,marginBottom:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,textAlign:'center'}}>
              <div><div style={{fontSize:11,color:C.muted}}>Today</div><div style={{fontSize:24,fontWeight:900,color:C.green}}>${todayEarnings}</div></div>
              <div><div style={{fontSize:11,color:C.muted}}>This Week</div><div style={{fontSize:24,fontWeight:900,color:C.text}}>${weekEarnings}</div></div>
              <div><div style={{fontSize:11,color:C.muted}}>Rating</div><div style={{fontSize:24,fontWeight:900,color:C.yellow}}>★ 4.9</div></div>
            </div>
          </div>

          <div style={{...cardStyle,...flex('row','center','space-between'),marginBottom:16,border:`1px solid ${onDuty?`${C.green}40`:C.border}`}}>
            <div><div style={{fontSize:16,fontWeight:700,color:C.text}}>Availability</div><div style={{fontSize:12,color:onDuty?C.green:C.muted}}>{onDuty?'Receiving booking requests':'Go online to receive bookings'}</div></div>
            <button onClick={()=>setOnDuty(!onDuty)} style={{width:56,height:32,borderRadius:16,background:onDuty?C.green:C.grayLighter,border:'none',cursor:'pointer',position:'relative',transition:'all .3s'}}><div style={{width:26,height:26,borderRadius:'50%',background:C.white,position:'absolute',top:3,left:onDuty?27:3,transition:'left .3s',boxShadow:'0 2px 4px rgba(0,0,0,0.15)'}}/></button>
          </div>

          {/* Map */}
          <div style={{height:200,background:C.card,borderRadius:20,marginBottom:16,position:'relative',overflow:'hidden',...flex('column','center','center'),border:`1px solid ${C.border}`}}>
            <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.5}}/>
            <div style={{position:'relative',width:14,height:14,borderRadius:'50%',background:onDuty?C.green:C.grayLight,boxShadow:onDuty?`0 0 20px ${C.green}80`:'none'}}/>
            <div style={{position:'absolute',bottom:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>{onDuty?'🟢 Live':'⚫ Offline'}</div>
          </div>

          <div style={cardStyle}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Incoming Bookings</div>
            {!onDuty?<div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:28,marginBottom:8}}>💤</div><div style={{fontSize:13,color:C.muted}}>Go online to receive bookings</div></div>:
            <div style={{textAlign:'center',padding:'20px 0'}}><div style={{fontSize:28,marginBottom:8}}>📡</div><div style={{fontSize:13,color:C.green}}>Listening for requests...</div></div>}
          </div>
        </div>
      )}

      {tab==='jobs'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Recent Bookings</h2>
          {STYLIST_HISTORY.map((m,i)=>(
            <div key={i} style={{...cardStyle,...flex('row','center','space-between'),marginBottom:12}}>
              <div><div style={{fontSize:15,fontWeight:700,color:C.text}}>{m.service}</div><div style={{fontSize:12,color:C.muted}}>{m.client} · {m.time}</div><div style={{fontSize:11,color:C.yellow}}>{'★'.repeat(m.rating)}</div></div>
              <div style={{fontSize:20,fontWeight:800,color:C.green}}>+${m.earned}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='earnings'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Earnings</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
            <div style={{...cardStyle,textAlign:'center'}}><div style={{fontSize:11,color:C.muted}}>Today</div><div style={{fontSize:32,fontWeight:900,color:C.green}}>${todayEarnings}</div></div>
            <div style={{...cardStyle,textAlign:'center'}}><div style={{fontSize:11,color:C.muted}}>This Week</div><div style={{fontSize:32,fontWeight:900,color:C.text}}>${weekEarnings}</div></div>
          </div>
          <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:12}}>Payout Breakdown</h3>
          <div style={cardStyle}>
            {([['Base earnings','$1,280.00'],['Tips','$165.00'],['Bonuses','$75.00'],['Platform fee','-$128.00']] as const).map(([label,val])=>(
              <div key={label} style={{...flex('row','center','space-between'),padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:14,color:C.gray}}>{label}</span><span style={{fontSize:14,fontWeight:700,color:val.startsWith('-')?C.red:C.text}}>{val}</span></div>
            ))}
            <div style={{...flex('row','center','space-between'),padding:'12px 0 0'}}><span style={{fontSize:16,fontWeight:800,color:C.text}}>Net Payout</span><span style={{fontSize:20,fontWeight:900,color:C.green}}>$1,392.00</span></div>
          </div>
        </div>
      )}

      {tab==='profile'&&(
        <div className="anim-tab" style={{padding:20,...flex('column','center','center'),minHeight:'60vh'}}>
          <div style={{width:80,height:80,borderRadius:20,background:`${C.secondary}12`,...flex('row','center','center'),fontSize:36,marginBottom:16}}>✂️</div>
          <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{userName||'Stylist'}</div>
          <div style={{fontSize:13,color:C.green,marginBottom:24}}>★ 4.9 Rating · 312 Bookings</div>
          {['My Profile','Specialties & Licensing','Portfolio','Payout Settings','Studio Info','Help & Support'].map(item=>(
            <div key={item} style={{...cardStyle,width:'100%',marginBottom:8,...flex('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}>
              <span style={{fontSize:14,color:C.text}}>{item}</span><span style={{color:C.muted}}>→</span>
            </div>
          ))}
          <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:8})}}>Sign Out</button>
        </div>
      )}

      {/* Bottom Nav — GOLD TRIM */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px) saturate(180%)',WebkitBackdropFilter:'blur(20px) saturate(180%)',borderTop:`1.5px solid ${GOLD}35`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...flex('row','center','space-around'),zIndex:40,boxShadow:`0 -2px 12px ${GOLD_GLOW}`}}>
        {([['dashboard','📊','Dashboard'],['jobs','📋','Bookings'],['earnings','💰','Earnings'],['profile','👤','Profile']] as const).map(([id,ic,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...flex('column','center','center',2),padding:'6px 12px'}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,color:tab===id?C.secondary:C.muted,fontWeight:tab===id?700:500}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
