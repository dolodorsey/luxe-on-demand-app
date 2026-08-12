import LuxeMobilityEntry from '../components/LuxeMobilityEntry'
import LuxeSupplyStatusHost from '../components/LuxeSupplyStatusHost'
import LuxeSubcategoryRestoreHost from '../components/LuxeSubcategoryRestoreHost'
import LuxeShellControlHost from '../components/LuxeShellControlHost'
import LuxeBottomNavHost from '../components/LuxeBottomNavHost'
import { LUXE_CURRENT_MOTION } from '../config/luxe-mobility-backend'
import './luxe-current-media.css'
import './luxe-sos-structure.css'

export default function HomePage() {
  return <>
    <header className="lm-current-brandbar" aria-label="LUXE On Demand">
      <img src="/brand/luxe-logo.webp" alt="LUXE On Demand" />
    </header>
    <section className="lm-current-media" aria-label="LUXE premium mobility animation">
      <video src={LUXE_CURRENT_MOTION} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
    </section>
    <LuxeSupplyStatusHost />
    <LuxeMobilityEntry />
    <LuxeShellControlHost />
    <LuxeSubcategoryRestoreHost />
    <LuxeBottomNavHost />
  </>
}
