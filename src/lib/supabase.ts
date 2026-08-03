import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzlmtvodpyhetvektfuo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const N8N_BASE = 'https://dorsey.app.n8n.cloud/webhook';

export const signUp = async (email: string, password: string, fullName: string, role: 'client' | 'stylist') => {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  fetch(`${N8N_BASE}/luxe-new-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, full_name: fullName, role, user_id: data.user?.id || '' }) }).catch(() => {});
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => { await supabase.auth.signOut(); };

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const getCsUserId = async (authId: string): Promise<string | null> => {
  const { data } = await supabase.from('cs_users').select('id').eq('auth_id', authId).single();
  return data?.id || null;
};

export const getProfile = async (authId: string) => {
  const { data, error } = await supabase.from('cs_users').select('*').eq('auth_id', authId).single();
  if (error) throw error;
  return data;
};

export const createBooking = async (booking: { client_auth_id: string; subcategory_id?: string; subcategory_name: string; category_name?: string; service_mode: 'mobile' | 'in_studio'; address?: string; lat?: number; lng?: number; estimated_price?: number; scheduled_at?: string; client_notes?: string; }) => {
  const csUserId = await getCsUserId(booking.client_auth_id);
  if (!csUserId) throw new Error('No LUXE client profile found');
  const { data, error } = await supabase.rpc('cs_request_booking', { p_service_name: booking.subcategory_name, p_service_mode: booking.service_mode, p_address: booking.address || null, p_lat: booking.lat || null, p_lng: booking.lng || null, p_scheduled_at: booking.scheduled_at || null, p_notes: booking.client_notes || null });
  if (error) throw error;
  const { data: profile } = await supabase.from('cs_users').select('first_name, last_name, email').eq('id', csUserId).single();
  fetch(`${N8N_BASE}/luxe-booking-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: data.id, client_id: booking.client_auth_id, client_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), client_email: profile?.email || '', service: booking.subcategory_name, category: booking.category_name, service_mode: booking.service_mode, price: booking.estimated_price, address: booking.address, status: 'requested' }) }).catch(() => {});
  return data;
};

export const getStylistProfile = async (authId: string) => {
  const userId = await getCsUserId(authId); if (!userId) return null;
  const { data, error } = await supabase.from('cs_stylists').select('*').eq('user_id', userId).single();
  if (error) return null; return data;
};
export const getStylistBookings = async () => { const { data,error }=await supabase.from('cs_bookings').select('*').order('created_at',{ascending:false});if(error)throw error;return data||[]; };
export const getAvailableRequests = async () => { const {data,error}=await supabase.rpc('cs_available_requests');if(error)throw error;return data||[]; };
export const setStylistDuty = async (onDuty:boolean,lat?:number,lng?:number) => { const {data,error}=await supabase.rpc('cs_set_on_duty',{p_on_duty:onDuty,p_lat:lat||null,p_lng:lng||null});if(error)throw error;return data; };
export const acceptRequest = async (id:string) => { const {data,error}=await supabase.rpc('cs_accept_request',{p_booking_id:id});if(error)throw error;return data; };
export const transitionBooking = async (id:string,status:string) => { const {data,error}=await supabase.rpc('cs_stylist_transition',{p_booking_id:id,p_status:status});if(error)throw error;return data; };
export const paymentAction = async (action:'authorize'|'capture'|'cancel'|'connect_onboarding',bookingId='') => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again');
  const response = await fetch(`${supabaseUrl}/functions/v1/luxe-payments`, { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${session.access_token}`, apikey:supabaseAnonKey }, body:JSON.stringify({action,booking_id:bookingId||'connect'}) });
  const data = await response.json(); if(!response.ok) throw new Error(data.error||'Payment request failed'); return data;
};
export const getBookingPayments = async () => { const {data,error}=await supabase.from('cs_booking_payments').select('*').order('created_at',{ascending:false});if(error)throw error;return data||[]; };
export const rateBooking = async (bookingId:string,rating:number,review='') => { const {data,error}=await supabase.rpc('cs_rate_booking',{p_booking_id:bookingId,p_rating:rating,p_review:review});if(error)throw error;return data; };

export const getBookings = async (authUserId: string) => {
  const csUserId = await getCsUserId(authUserId);
  if (!csUserId) return [];
  const { data, error } = await supabase.from('cs_bookings').select('*,cs_subcategories(name)').eq('client_id', csUserId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
