import LuxeMobilityEntry from '../components/LuxeMobilityEntry'
import LuxeSupplyStatusHost from '../components/LuxeSupplyStatusHost'
import LuxeSubcategoryRestoreHost from '../components/LuxeSubcategoryRestoreHost'
import LuxeShellControlHost from '../components/LuxeShellControlHost'
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
        <p>Private rides, airport movement and executive transportation unlock class-by-class as approved LUXE drivers become payout-ready and go on duty.</p>
      </div>
      <div className="lm-current-media__status">VERIFIED DRIVER NETWORK</div>
    </section>
    <LuxeSupplyStatusHost />
    <LuxeMobilityEntry />
    <LuxeShellControlHost />
    <LuxeSubcategoryRestoreHost />
  </>
}
