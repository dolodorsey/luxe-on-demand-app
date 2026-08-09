import LuxeMobilityEntry from '../components/LuxeMobilityEntry'
import { LUXE_CURRENT_MOTION } from '../config/luxe-mobility-backend'
import './luxe-current-media.css'

export default function HomePage() {
  return <>
    <section className="lm-current-media" aria-label="LUXE premium mobility">
      <video src={LUXE_CURRENT_MOTION} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
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
