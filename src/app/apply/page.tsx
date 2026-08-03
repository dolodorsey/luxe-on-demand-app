"use client";
import { useState } from "react";

const SERVICES = [
  { cat: "Hair — Silk & Press", items: ["Silk Press","Blowout","Flat Iron Styling","Roller Set","Press & Curl"] },
  { cat: "Hair — Natural", items: ["Wash & Go","Twist Out","Braid Out","Bantu Knot Out","Coil Set","Rod Set"] },
  { cat: "Hair — Braids", items: ["Box Braids","Knotless Braids","Cornrows","Feed-In Braids","Lemonade Braids","Fulani Braids","Goddess Braids"] },
  { cat: "Hair — Extensions", items: ["Sew-In Weave","Quick Weave","Wig Install","Custom Wig Build","Tape-In Extensions"] },
  { cat: "Hair — Color", items: ["Single Process Color","Highlights","Balayage","Vivid Color","Color Correction"] },
  { cat: "Hair — Barber", items: ["Men's Haircut","Fade","Lineup","Beard Trim","Hot Towel Shave"] },
  { cat: "Makeup", items: ["Natural Look","Soft Glam","Full Glam","Bridal Trial","Bridal Day-Of","Airbrush","Editorial"] },
  { cat: "Lashes", items: ["Classic Extensions","Volume Lashes","Hybrid Lashes","Lash Fill","Lash Lift & Tint"] },
  { cat: "Brows", items: ["Brow Shaping","Brow Tinting","Brow Lamination","Henna Brows"] },
  { cat: "Nails", items: ["Basic Manicure","Gel Manicure","Acrylic Full Set","Pedicure","Nail Art"] },
  { cat: "Skincare", items: ["Basic Facial","Deep Cleansing","Chemical Peel","Dermaplaning","LED Therapy"] },
  { cat: "Waxing", items: ["Eyebrow Wax","Full Face","Brazilian","Full Body"] },
  { cat: "Spray Tan", items: ["Full Body Spray Tan","Express Spray Tan","Body Shimmer"] },
  { cat: "Bridal & Events", items: ["Bridal Solo Package","Bridal Party","Group Glam","Glam Squad"] },
];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const APPLICATION_ENDPOINT = "https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/luxe-provider-application";

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ first_name:"",last_name:"",email:"",phone:"",city:"",state:"",zip_code:"",services_requested:[] as string[],years_experience:"",experience_description:"",has_vehicle:false,vehicle_type:"",background_check_consent:false,portfolio_url:"" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string|null>(null);

  const u = (k:string,v:any) => setForm(p => ({...p,[k]:v}));
  const toggleSvc = (s:string) => setForm(p => ({...p, services_requested: p.services_requested.includes(s) ? p.services_requested.filter(x=>x!==s) : [...p.services_requested, s]}));

  const canNext = () => {
    if (step===0) return form.first_name && form.last_name && form.email && form.phone && form.city && form.state;
    if (step===1) return form.services_requested.length > 0;
    if (step===2) return form.years_experience && form.background_check_consent;
    return true;
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(APPLICATION_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, state_code:form.state}) });
      if (!res.ok) throw new Error("Application service unavailable");
      const data = await res.json();
      if (data.success) { setResult(data); setStep(4); } else setError(data.error||"Failed");
    } catch(e) { setError("Network error"); }
    setSubmitting(false);
  };

  const s = (css:any) => css;

  return (
    <div style={{minHeight:"100vh",background:"#FAF7F4",color:"#1a1a1a",fontFamily:"system-ui, sans-serif"}}>
      <div style={{background:"linear-gradient(135deg, #2D1B4E 0%, #1a0a2e 100%)",padding:"40px 24px",textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:"0.4em",color:"#D4B87A",marginBottom:8}}>LUXE ON DEMAND</div>
        <div style={{fontSize:30,fontWeight:300,color:"#fff",letterSpacing:"-0.02em"}}>Join Our Provider Network</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.6)",marginTop:6}}>Premium mobile beauty & wellness professionals</div>
      </div>
      <div style={{height:260,maxWidth:600,margin:"0 auto",overflow:"hidden",position:"relative",borderBottom:"1px solid #D4B87A"}}>
        <img src="/brand/luxe-provider-process.png" alt="How to become a LUXE provider" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 10%",display:"block"}} />
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 55%,rgba(26,10,46,.82) 100%)"}} />
        <div style={{position:"absolute",left:20,right:20,bottom:14,color:"#fff",fontSize:13,letterSpacing:".08em"}}>APPLY · GET REVIEWED · SET AVAILABILITY</div>
      </div>
      {step < 4 && (
        <div style={{maxWidth:600,margin:"0 auto",padding:"12px 24px"}}>
          <div style={{display:"flex",gap:4}}>
            {["Info","Services","Experience","Review"].map((l,i) => (
              <div key={i} style={{flex:1}}>
                <div style={{height:3,borderRadius:4,background:i<=step?"#7C3AED":"#e0dcd8"}} />
                <div style={{fontSize:10,textAlign:"center",marginTop:4,color:i===step?"#1a1a1a":"#999"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{maxWidth:600,margin:"0 auto",padding:"24px"}}>
        {step===0 && (<div>
          <h2 style={{fontSize:22,fontWeight:600,marginBottom:16}}>Personal Information</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>First Name *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.first_name} onChange={e=>u("first_name",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Last Name *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.last_name} onChange={e=>u("last_name",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Email *</label><input type="email" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.email} onChange={e=>u("email",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Phone *</label><input type="tel" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.phone} onChange={e=>u("phone",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>City *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.city} onChange={e=>u("city",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>State *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.state} onChange={e=>u("state",e.target.value)}><option value="">--</option>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Zip</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.zip_code} onChange={e=>u("zip_code",e.target.value)} /></div>
          </div>
        </div>)}

        {step===1 && (<div>
          <h2 style={{fontSize:22,fontWeight:600,marginBottom:4}}>Select Your Specialties</h2>
          <p style={{fontSize:13,color:"#888",marginBottom:16}}>{form.services_requested.length} selected</p>
          {SERVICES.map(cat => (
            <div key={cat.cat} style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#999",marginBottom:8}}>{cat.cat}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cat.items.map(s => (
                  <button key={s} onClick={()=>toggleSvc(s)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,border:form.services_requested.includes(s)?"1px solid #7C3AED":"1px solid #d5d0ca",background:form.services_requested.includes(s)?"#7C3AED":"#fff",color:form.services_requested.includes(s)?"#fff":"#555",cursor:"pointer"}}>{form.services_requested.includes(s)?"✓ ":""}{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>)}

        {step===2 && (<div>
          <h2 style={{fontSize:22,fontWeight:600,marginBottom:16}}>Experience & Portfolio</h2>
          <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Years of Experience *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} value={form.years_experience} onChange={e=>u("years_experience",e.target.value)}><option value="">Select</option><option value="0">Less than 1</option><option value="1">1-2 years</option><option value="3">3-5 years</option><option value="5">5-10 years</option><option value="10">10+ years</option></select></div>
          <div style={{marginTop:12}}><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Portfolio / Instagram URL</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14}} placeholder="https://instagram.com/yourwork" value={form.portfolio_url} onChange={e=>u("portfolio_url",e.target.value)} /></div>
          <div style={{marginTop:12}}><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#888",marginBottom:6}}>Experience Description</label><textarea style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid #d5d0ca",background:"#fff",fontSize:14,height:80,resize:"none"}} value={form.experience_description} onChange={e=>u("experience_description",e.target.value)} /></div>
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={form.has_vehicle} onChange={e=>u("has_vehicle",e.target.checked)} /><span style={{fontSize:14}}>I have a vehicle for mobile service</span></div>
          <div style={{marginTop:20,padding:16,background:"#fff",borderRadius:12,border:"1px solid #d5d0ca"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}><input type="checkbox" checked={form.background_check_consent} onChange={e=>u("background_check_consent",e.target.checked)} style={{marginTop:3}} /><div><div style={{fontSize:14,fontWeight:600}}>Background Check Consent *</div><div style={{fontSize:12,color:"#888",marginTop:4}}>I authorize The Kollective Hospitality Group to conduct a background check including criminal history and identity verification.</div></div></div>
          </div>
        </div>)}

        {step===3 && (<div>
          <h2 style={{fontSize:22,fontWeight:600,marginBottom:16}}>Review & Submit</h2>
          <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,border:"1px solid #e8e4df"}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#999",marginBottom:6}}>Personal</div><div style={{fontWeight:600}}>{form.first_name} {form.last_name}</div><div style={{fontSize:13,color:"#888"}}>{form.email} · {form.phone}</div><div style={{fontSize:13,color:"#888"}}>{form.city}, {form.state}</div></div>
          <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,border:"1px solid #e8e4df"}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#999",marginBottom:6}}>Services ({form.services_requested.length})</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{form.services_requested.map(s=><span key={s} style={{padding:"3px 10px",background:"#f0ede8",borderRadius:12,fontSize:11}}>{s}</span>)}</div></div>
          {error && <div style={{marginTop:12,padding:12,background:"#fff5f5",border:"1px solid #e8c4c4",borderRadius:8,fontSize:13,color:"#c41e3a"}}>{error}</div>}
        </div>)}

        {step===4 && result && (<div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:64,marginBottom:16}}>✨</div>
          <h2 style={{fontSize:28,fontWeight:300,letterSpacing:"-0.02em",marginBottom:8}}>Application Submitted</h2>
          <div style={{display:"inline-block",padding:"8px 20px",background:"#2D1B4E",color:"#D4B87A",borderRadius:8,fontFamily:"monospace",fontSize:18,marginBottom:16}}>{result.application_number}</div>
          <p style={{color:"#888",maxWidth:400,margin:"0 auto",fontSize:14}}>Our team will review your application within 2-3 business days including portfolio review and credential verification.</p>
        </div>)}

        {step < 4 && (
          <div style={{display:"flex",justifyContent:"space-between",marginTop:32,paddingTop:20,borderTop:"1px solid #e8e4df"}}>
            {step>0 ? <button onClick={()=>setStep(s=>s-1)} style={{padding:"10px 24px",fontSize:14,color:"#888",background:"none",border:"none",cursor:"pointer"}}>← Back</button> : <div/>}
            {step<3 ? <button onClick={()=>canNext()&&setStep(s=>s+1)} disabled={!canNext()} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:canNext()?"#7C3AED":"#e0dcd8",color:canNext()?"#fff":"#999",border:"none",cursor:canNext()?"pointer":"not-allowed"}}>Continue →</button>
            : <button onClick={submit} disabled={submitting} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:"#D4B87A",color:"#1a1a1a",border:"none",cursor:"pointer"}}>{submitting?"Submitting...":"Submit Application"}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
