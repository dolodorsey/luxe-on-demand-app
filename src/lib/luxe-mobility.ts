'use client'

import { createClient } from '@supabase/supabase-js'
import {
  LUXE_APPROVED_PUBLISHABLE_KEY,
  LUXE_APPROVED_SUPABASE_URL,
  LUXE_BACKEND_MODE,
} from '../config/luxe-public-backend'

export const luxeMobility = createClient(LUXE_APPROVED_SUPABASE_URL, LUXE_APPROVED_PUBLISHABLE_KEY)
export { LUXE_BACKEND_MODE }

export type VehicleClass = {
  id:string
  name:string
  description:string|null
  base_fare:number
  per_mile:number
  per_minute:number
  minimum_fare:number
  capacity:number
  sort_order:number
}

export type LuxeRide = {
  id:string
  rider_profile_id:string
  driver_id:string|null
  vehicle_class_id:string
  pickup_address:string
  destination_address:string
  route_distance_miles:number
  route_duration_minutes:number
  quoted_fare:number
  final_fare:number|null
  status:'matching'|'accepted'|'en_route'|'arrived'|'in_progress'|'completed'|'canceled'
  scheduled_at:string|null
  accepted_at:string|null
  en_route_at:string|null
  arrived_at:string|null
  started_at:string|null
  completed_at:string|null
  created_at:string
}

export async function loadVehicleClasses() {
  const { data,error } = await luxeMobility.from('lm_vehicle_classes').select('*').eq('is_active',true).order('sort_order')
  if(error) throw error
  return (data||[]) as VehicleClass[]
}

export async function getMobilitySession() {
  const {data:{session}} = await luxeMobility.auth.getSession()
  return session
}

export async function signInMobility(email:string,password:string) {
  const {data,error}=await luxeMobility.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
  if(error) throw error
  return data
}

export async function signUpMobility(email:string,password:string,fullName:string) {
  const {data,error}=await luxeMobility.auth.signUp({
    email:email.trim().toLowerCase(),password,
    options:{data:{full_name:fullName.trim(),app:'luxe_mobility'},emailRedirectTo:'https://luxe-on-demand-app.vercel.app/auth/confirm'},
  })
  if(error) throw error
  if(data.session) await ensureRiderProfile(fullName)
  return data
}

export async function ensureRiderProfile(fullName:string,phone?:string) {
  const {data,error}=await luxeMobility.rpc('lm_upsert_rider_profile',{p_full_name:fullName,p_phone:phone||null})
  if(error) throw error
  return data
}

export async function loadMyProfile() {
  const {data:{user}}=await luxeMobility.auth.getUser()
  if(!user) return null
  const {data,error}=await luxeMobility.from('lm_profiles').select('*').eq('auth_id',user.id).maybeSingle()
  if(error) throw error
  return data
}

export async function quoteRide(vehicleClassId:string,distanceMiles:number,durationMinutes:number) {
  const {data,error}=await luxeMobility.rpc('lm_quote_fare',{
    p_vehicle_class_id:vehicleClassId,p_distance_miles:distanceMiles,p_duration_minutes:durationMinutes,
  })
  if(error) throw error
  return Number(data)
}

export async function requestRide(input:{
  vehicleClassId:string
  pickup:string
  destination:string
  distanceMiles:number
  durationMinutes:number
  scheduledAt?:string|null
}) {
  const {data,error}=await luxeMobility.rpc('lm_request_ride',{
    p_vehicle_class_id:input.vehicleClassId,
    p_pickup_address:input.pickup,
    p_destination_address:input.destination,
    p_distance_miles:input.distanceMiles,
    p_duration_minutes:input.durationMinutes,
    p_pickup_lat:null,p_pickup_lng:null,p_destination_lat:null,p_destination_lng:null,
    p_scheduled_at:input.scheduledAt||null,
  })
  if(error) throw error
  return data as LuxeRide
}

export async function loadMyRides(profileId:string) {
  const {data,error}=await luxeMobility.from('lm_rides').select('*').eq('rider_profile_id',profileId).order('created_at',{ascending:false})
  if(error) throw error
  return (data||[]) as LuxeRide[]
}

export async function cancelRide(rideId:string,reason?:string) {
  const {data,error}=await luxeMobility.rpc('lm_cancel_ride',{p_ride_id:rideId,p_reason:reason||null})
  if(error) throw error
  return data as LuxeRide
}

export async function rateRide(rideId:string,rating:number,comment?:string) {
  const {data,error}=await luxeMobility.rpc('lm_rate_ride',{p_ride_id:rideId,p_rating:rating,p_comment:comment||null})
  if(error) throw error
  return data
}

export async function loadDriverOffers() {
  const {data,error}=await luxeMobility.rpc('lm_available_rides')
  if(error) throw error
  return (data||[]) as LuxeRide[]
}

export async function acceptRide(rideId:string) {
  const {data,error}=await luxeMobility.rpc('lm_accept_ride',{p_ride_id:rideId})
  if(error) throw error
  return data as LuxeRide
}

export async function transitionRide(rideId:string,status:'en_route'|'arrived'|'in_progress'|'completed') {
  const {data,error}=await luxeMobility.rpc('lm_driver_transition',{p_ride_id:rideId,p_status:status})
  if(error) throw error
  return data as LuxeRide
}

export async function authorizeRidePayment(rideId:string) {
  const {data,error}=await luxeMobility.functions.invoke('luxe-mobility-payments',{body:{action:'authorize',rideId}})
  if(error) throw error
  return data as {clientSecret:string;paymentId:string;amount:number}
}
