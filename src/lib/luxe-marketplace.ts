import { supabase } from './supabase'

export type LuxeCategory = {
  id: string
  name: string
  description: string | null
  sort_order: number | null
  is_active: boolean | null
}

export type LuxeService = {
  id: string
  category_id: string
  name: string
  description: string | null
  base_price: number | null
  min_price: number | null
  max_price: number | null
  duration_minutes: number | null
  mobile_available: boolean | null
  in_studio_available: boolean | null
  rush_eligible: boolean | null
  regulated: boolean | null
  mobile_fee: number | null
  rush_fee: number | null
  provider_credential_required: string | null
  compliance_note: string | null
  icon_url: string | null
  sort_order: number | null
}

export type LuxeBooking = {
  id: string
  client_id: string
  stylist_id: string | null
  category_id: string | null
  subcategory_id: string | null
  status: string
  service_mode: 'mobile' | 'in_studio'
  service_address: string | null
  service_lat: number | null
  service_lng: number | null
  estimated_price: number | null
  final_price: number | null
  scheduled_at: string | null
  booking_type: string | null
  client_notes: string | null
  eta_minutes: number | null
  created_at: string
  accepted_at: string | null
  en_route_at: string | null
  arrived_at: string | null
  started_at: string | null
  completed_at: string | null
  canceled_at: string | null
  stylist?: {
    id: string
    display_name: string | null
    business_name: string | null
    rating: number | null
    total_bookings: number | null
    level: string | null
    portfolio_urls: string[] | null
    user?: {
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    } | null
  } | null
}

export async function loadLuxeCatalog() {
  const [categoryResult, serviceResult] = await Promise.all([
    supabase.from('cs_categories').select('id,name,description,sort_order,is_active').eq('is_active', true).order('sort_order'),
    supabase.from('cs_subcategories').select('id,category_id,name,description,base_price,min_price,max_price,duration_minutes,mobile_available,in_studio_available,rush_eligible,regulated,mobile_fee,rush_fee,provider_credential_required,compliance_note,icon_url,sort_order').eq('is_active', true).order('category_id').order('sort_order'),
  ])
  if (categoryResult.error) throw categoryResult.error
  if (serviceResult.error) throw serviceResult.error
  return {
    categories: (categoryResult.data || []) as LuxeCategory[],
    services: (serviceResult.data || []) as LuxeService[],
  }
}

export async function loadLuxeClientProfile(authId: string) {
  const { data, error } = await supabase.from('cs_users').select('*').eq('auth_id', authId).single()
  if (error) throw error
  return data
}

export async function loadLuxeBookings(clientId: string) {
  const { data, error } = await supabase
    .from('cs_bookings')
    .select('*,stylist:cs_stylists!cs_bookings_stylist_id_fkey(id,display_name,business_name,rating,total_bookings,level,portfolio_urls,user:cs_users!cs_stylists_user_id_fkey(first_name,last_name,avatar_url))')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as LuxeBooking[]
}

export async function createLuxeBooking(input: {
  serviceName: string
  serviceMode: 'mobile' | 'in_studio'
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  scheduledAt?: string | null
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc('cs_request_booking', {
    p_service_name: input.serviceName,
    p_service_mode: input.serviceMode,
    p_address: input.address || null,
    p_lat: input.latitude ?? null,
    p_lng: input.longitude ?? null,
    p_scheduled_at: input.scheduledAt || null,
    p_notes: input.notes || null,
  })
  if (error) throw error
  return data as LuxeBooking
}

export async function cancelLuxeBooking(bookingId: string, reason = 'Client canceled from app') {
  const { data, error } = await supabase.rpc('cs_client_cancel', {
    p_booking_id: bookingId,
    p_reason: reason,
  })
  if (error) throw error

  const { data: payment } = await supabase.from('cs_booking_payments').select('id,status').eq('booking_id', bookingId).maybeSingle()
  if (payment && !['captured','transferred','partially_refunded','refunded','canceled'].includes(payment.status)) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) {
      const response = await fetch('https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/luxe-payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          apikey: 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR',
        },
        body: JSON.stringify({ action:'cancel', booking_id:bookingId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Booking canceled, but payment authorization needs attention.')
    }
  }
  return data as LuxeBooking
}

export async function rateLuxeBooking(bookingId: string, rating: number, review = '') {
  const { data, error } = await supabase.rpc('cs_rate_booking', {
    p_booking_id: bookingId,
    p_rating: rating,
    p_review: review,
  })
  if (error) throw error
  return data
}

export async function authorizeLuxeBooking(bookingId: string) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Please sign in again.')
  const response = await fetch('https://dzlmtvodpyhetvektfuo.supabase.co/functions/v1/luxe-payments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      apikey: 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR',
    },
    body: JSON.stringify({ action:'authorize', booking_id:bookingId }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Payment authorization is unavailable.')
  return payload
}

export function luxeBookingStage(status: string) {
  return ({
    requested:'requested', matched:'matching', accepted:'assigned', en_route:'en_route',
    arrived:'arrived', in_progress:'working', completed:'completed', canceled:'canceled',
  } as Record<string,string>)[status] || 'requested'
}
