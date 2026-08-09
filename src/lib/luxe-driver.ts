'use client'

import { luxeMobility, type LuxeRide } from './luxe-mobility'

export async function loadDriverActiveRides() {
  const {data,error}=await luxeMobility.rpc('lm_driver_active_rides')
  if(error) throw error
  return (data||[]) as LuxeRide[]
}
