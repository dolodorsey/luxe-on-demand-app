import LuxeMobilityEntry from '../components/LuxeMobilityEntry'
import './luxe-current-media.css'

const CURRENT_LUXE_MOTION = 'https://dzlmtvodpyhetvektfuo.supabase.co/storage/v1/object/public/brand-graphics/kollective/animations/LUXE_ON_DEMAND_ANI.mp4'

export default function HomePage() {
  return <>
    <section className="lm-current-media" aria-label="LUXE premium mobility">
      <video src={CURRENT_LUXE_MOTION} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
      <div className="lm-current-media__shade" />
      <div className="lm-current-media__copy">
        <span>LUXE ON DEMAND · PREMIUM MOBILITY</span>
        <strong>Your city. Your driver. Your standard.</strong>
        <p>Private rides, airport movement and executive transportation from one verified premium network.</p>
      </div>
      <div className="lm-current-media__status">MOBILITY BUILD</div>
    </section>
    <LuxeMobilityEntry />
  </>
}