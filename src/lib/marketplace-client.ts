import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'LUXE requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Do not embed production credentials in source code.'
  );
}

export const luxeSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type Json = Record<string, unknown>;

const unwrap = <T>({ data, error }: { data: T; error: Error | null }): T => {
  if (error) throw error;
  return data;
};

export async function ensureLuxeProfile(profile: {
  firstName?: string;
  lastName?: string;
  role?: 'client' | 'stylist';
  gender?: string;
}) {
  return unwrap(
    await luxeSupabase.rpc('cs_upsert_current_user_profile', {
      p_first_name: profile.firstName ?? null,
      p_last_name: profile.lastName ?? null,
      p_role: profile.role ?? 'client',
      p_gender: profile.gender ?? null,
    })
  );
}

export async function getLuxeServiceCatalog() {
  const { data, error } = await luxeSupabase
    .from('cs_categories')
    .select(
      'id, name, description, icon_url, sort_order, subcategories:cs_subcategories(id, name, description, price_model, base_price, min_price, max_price, duration_minutes, eta_band, required_license, required_tools, required_proof, risk_flags, mobile_available, in_studio_available, regulated, rush_eligible, mobile_fee, rush_fee, compliance_note, provider_credential_required, sort_order)'
    )
    .eq('is_active', true)
    .eq('subcategories.is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function browseLuxeStylists(options: {
  subcategoryId?: string;
  serviceMode?: 'mobile' | 'in_studio';
  limit?: number;
} = {}) {
  return unwrap(
    await luxeSupabase.rpc('cs_browse_stylists', {
      p_subcategory_id: options.subcategoryId ?? null,
      p_service_mode: options.serviceMode ?? null,
      p_limit: options.limit ?? 25,
    })
  );
}

export async function createLuxeBooking(input: {
  subcategoryId: string;
  categoryId?: string;
  serviceMode: 'mobile' | 'in_studio';
  address?: string;
  lat?: number;
  lng?: number;
  estimatedPrice: number;
  bookingType?: 'on_demand' | 'scheduled';
  scheduledAt?: string;
  scheduledWindowMinutes?: number;
  clientNotes?: string;
  clientPhotos?: string[];
  inspirationPhotos?: string[];
  locationType?: string;
  promoCode?: string;
  isGroupBooking?: boolean;
  groupSize?: number;
}) {
  const { data: profile, error: profileError } = await luxeSupabase
    .from('cs_users')
    .select('id')
    .single();
  if (profileError) throw profileError;

  const { data, error } = await luxeSupabase
    .from('cs_bookings')
    .insert({
      client_id: profile.id,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId,
      status: 'requested',
      service_mode: input.serviceMode,
      service_address: input.address ?? null,
      service_lat: input.lat ?? null,
      service_lng: input.lng ?? null,
      estimated_price: input.estimatedPrice,
      booking_type:
        input.bookingType ?? (input.scheduledAt ? 'scheduled' : 'on_demand'),
      scheduled_at: input.scheduledAt ?? null,
      scheduled_window_minutes: input.scheduledWindowMinutes ?? null,
      client_notes: input.clientNotes ?? null,
      client_photos: input.clientPhotos ?? [],
      inspiration_photos: input.inspirationPhotos ?? [],
      location_type: input.locationType ?? null,
      promo_code: input.promoCode ?? null,
      is_group_booking: input.isGroupBooking ?? false,
      group_size: input.groupSize ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await enqueueLuxeIntegrationEvent('booking.created', 'cs_booking', data.id, {
    booking_id: data.id,
    subcategory_id: input.subcategoryId,
    service_mode: input.serviceMode,
    estimated_price: input.estimatedPrice,
    booking_type: data.booking_type,
    scheduled_at: input.scheduledAt ?? null,
  });

  return data;
}

export async function dispatchLuxeBooking(
  bookingId: string,
  options: { radiusMiles?: number; offerTtlSeconds?: number } = {}
) {
  const data = unwrap(
    await luxeSupabase.rpc('cs_dispatch_booking', {
      p_booking_id: bookingId,
      p_radius_miles: options.radiusMiles ?? 20,
      p_offer_ttl_seconds: options.offerTtlSeconds ?? 60,
    })
  );
  return Number(data || 0);
}

export async function getLuxeBookings(role: 'client' | 'stylist' = 'client') {
  const column = role === 'stylist' ? 'stylist_id' : 'client_id';
  const profileTable = role === 'stylist' ? 'cs_stylists' : 'cs_users';

  const { data: profile, error: profileError } = await luxeSupabase
    .from(profileTable)
    .select('id')
    .single();
  if (profileError) throw profileError;

  const { data, error } = await luxeSupabase
    .from('cs_bookings')
    .select(
      '*, category:cs_categories(id, name), subcategory:cs_subcategories(id, name, duration_minutes, regulated), stylist:cs_stylists(id, display_name, rating, level, badges)'
    )
    .eq(column, profile.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLuxeStylistOffers() {
  const { data, error } = await luxeSupabase
    .from('cs_booking_offers')
    .select(
      'id, booking_id, status, distance_miles, eta_minutes, offered_at, expires_at, booking:cs_bookings(id, service_mode, service_address, estimated_price, scheduled_at, client_notes, category_id, subcategory_id)'
    )
    .eq('status', 'offered')
    .gt('expires_at', new Date().toISOString())
    .order('offered_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function acceptLuxeBookingOffer(offerId: string) {
  const data = unwrap(
    await luxeSupabase.rpc('cs_accept_booking_offer', {
      p_offer_id: offerId,
    })
  );
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function declineLuxeBookingOffer(
  offerId: string,
  reason: string | null = null
) {
  return Boolean(
    unwrap(
      await luxeSupabase.rpc('cs_decline_booking_offer', {
        p_offer_id: offerId,
        p_reason: reason,
      })
    )
  );
}

export async function updateLuxeStylistLocation(input: {
  lat: number;
  lng: number;
  onDuty?: boolean;
}) {
  return unwrap(
    await luxeSupabase.rpc('cs_update_stylist_location', {
      p_lat: input.lat,
      p_lng: input.lng,
      p_on_duty: input.onDuty ?? true,
    })
  );
}

export async function advanceLuxeBookingStatus(input: {
  bookingId: string;
  status: 'en_route' | 'arrived' | 'started' | 'completed';
  lat?: number;
  lng?: number;
  metadata?: Json;
}) {
  return unwrap(
    await luxeSupabase.rpc('cs_advance_booking_status', {
      p_booking_id: input.bookingId,
      p_new_status: input.status,
      p_lat: input.lat ?? null,
      p_lng: input.lng ?? null,
      p_metadata: input.metadata ?? {},
    })
  );
}

export async function cancelLuxeBooking(bookingId: string, reason: string) {
  return unwrap(
    await luxeSupabase.rpc('cs_cancel_booking', {
      p_booking_id: bookingId,
      p_reason: reason,
    })
  );
}

export async function getLuxeBookingTimeline(bookingId: string) {
  const { data, error } = await luxeSupabase
    .from('cs_booking_events')
    .select('id, event_type, actor_id, metadata, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function enqueueLuxeIntegrationEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string | null,
  payload: Json
) {
  return unwrap(
    await luxeSupabase.rpc('cs_enqueue_integration_event', {
      p_event_type: eventType,
      p_aggregate_type: aggregateType,
      p_aggregate_id: aggregateId,
      p_payload: payload,
    })
  );
}

export function subscribeToLuxeBooking(
  bookingId: string,
  onChange: (payload: unknown) => void
) {
  const channel = luxeSupabase
    .channel(`luxe-booking-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cs_bookings',
        filter: `id=eq.${bookingId}`,
      },
      onChange
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'cs_booking_events',
        filter: `booking_id=eq.${bookingId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    luxeSupabase.removeChannel(channel);
  };
}
