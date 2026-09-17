import { ImageResponse } from 'next/og'

export const runtime='edge'

export async function GET(request:Request){
  const requested=Number(new URL(request.url).searchParams.get('size')||512)
  const size=[180,192,512].includes(requested)?requested:512
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',background:'radial-gradient(circle at 25% 18%,rgba(210,180,120,.22),transparent 42%),linear-gradient(145deg,#161b21,#07090c 76%)'}}>
      <div style={{position:'absolute',inset:'8%',border:'1px solid rgba(222,201,158,.28)',borderRadius:'24%'}}/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:'68%',height:'68%',borderRadius:'26%',background:'linear-gradient(145deg,#1e252d,#090c10)',boxShadow:'0 28px 90px rgba(0,0,0,.5)',border:'2px solid rgba(222,201,158,.55)',color:'#f5eee0',fontFamily:'Arial,sans-serif'}}>
        <div style={{fontWeight:900,fontSize:size*.15,letterSpacing:-size*.008}}>LUXE</div>
        <div style={{marginTop:size*.025,fontWeight:700,fontSize:Math.max(9,size*.035),letterSpacing:size*.009,color:'#dec99e'}}>ON DEMAND</div>
      </div>
    </div>,{width:size,height:size}
  )
}
