import { redirect } from 'next/navigation'

export const metadata = {
  title: 'LUXE On Demand — Driver Network',
  description: 'LUXE On Demand is premium mobility. Driver applications continue through the LUXE driver network.',
}

export default function RetiredStylistApplicationPage() {
  redirect('/driver/apply')
}
