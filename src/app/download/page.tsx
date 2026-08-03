import Link from "next/link";

export const metadata = {
  title: "LUXE On Demand — App Release Status",
  description: "Official release status for the LUXE On Demand mobile apps.",
};

export default function DownloadPage() {
  return (
    <main style={{minHeight:"100vh",background:"radial-gradient(circle at top,#37231f,#090807 62%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",color:"#F8EEE8",padding:"32px 20px",textAlign:"center"}}>
      <section style={{width:"100%",maxWidth:560,border:"1px solid rgba(212,184,122,.45)",borderRadius:28,overflow:"hidden",background:"rgba(10,8,7,.88)",boxShadow:"0 30px 90px rgba(0,0,0,.5)"}}>
        <div style={{height:260,position:"relative",overflow:"hidden"}}>
          <img src="/brand/luxe-provider-process.png" alt="LUXE On Demand" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 8%",display:"block"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 35%,rgba(10,8,7,.96))"}}/>
        </div>
        <div style={{padding:"0 28px 34px",marginTop:-28,position:"relative"}}>
          <div style={{fontSize:11,letterSpacing:".28em",color:"#D4B87A",fontWeight:800}}>OFFICIAL RELEASE STATUS</div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(32px,8vw,48px)",margin:"12px 0 10px"}}>Mobile apps are in review.</h1>
          <p style={{color:"rgba(248,238,232,.72)",lineHeight:1.7,margin:"0 auto 24px",maxWidth:430}}>There is no public Android APK or active TestFlight invitation for this release. Signed download links will appear here only after platform verification.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
            <div style={{padding:16,borderRadius:14,background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.08)"}}><strong style={{display:"block",color:"#D4B87A"}}>iPhone</strong><span style={{fontSize:13}}>Not yet released</span></div>
            <div style={{padding:16,borderRadius:14,background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.08)"}}><strong style={{display:"block",color:"#D4B87A"}}>Android</strong><span style={{fontSize:13}}>Not yet released</span></div>
          </div>
          <Link href="/" style={{display:"inline-block",padding:"14px 24px",borderRadius:12,background:"linear-gradient(135deg,#D4B87A,#D69A78)",color:"#120d0a",fontWeight:800,textDecoration:"none"}}>Use LUXE on the web</Link>
        </div>
      </section>
    </main>
  );
}
