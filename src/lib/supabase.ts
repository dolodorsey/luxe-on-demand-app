import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzlmtvodpyhetvektfuo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const N8N_BASE = 'https://dorsey.app.n8n.cloud/webhook';

export const signUp = async (email: string, password: string, fullName: string, role: 'client' | 'stylist') => {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
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

export const createBooking = async (booking: { client_auth_id: string; subcategory_id: string; subcategory_name: string; category_name: string; service_mode: 'mobile' | 'in_studio'; address?: string; lat?: number; lng?: number; estimated_price: number; scheduled_at?: string; client_notes?: string; }) => {
  const csUserId = await getCsUserId(booking.client_auth_id);
  if (!csUserId) throw new Error('No cs_users record found');
  const { data, error } = await supabase.from('cs_bookings').insert({ client_id: csUserId, subcategory_id: booking.subcategory_id, status: 'requested', service_mode: booking.service_mode, service_address: booking.address || null, service_lat: booking.lat || null, service_lng: booking.lng || null, estimated_price: booking.estimated_price, booking_type: booking.scheduled_at ? 'scheduled' : 'on_demand', scheduled_at: booking.scheduled_at || null, client_notes: booking.client_notes || null }).select().single();
  if (error) throw error;
  const { data: profile } = await supabase.from('cs_users').select('first_name, last_name, email').eq('id', csUserId).single();
  fetch(`${N8N_BASE}/luxe-booking-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: data.id, client_id: booking.client_auth_id, client_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), client_email: profile?.email || '', service: booking.subcategory_name, category: booking.category_name, service_mode: booking.service_mode, price: booking.estimated_price, address: booking.address, status: 'requested' }) }).catch(() => {});
  return data;
};

export const getBookings = async (authUserId: string) => {
  const csUserId = await getCsUserId(authUserId);
  if (!csUserId) return [];
  const { data, error } = await supabase.from('cs_bookings').select('*').eq('client_id', csUserId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
