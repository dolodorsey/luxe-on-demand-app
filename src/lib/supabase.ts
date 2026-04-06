import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Category = {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_model: "flat" | "hourly" | "starting_at" | "custom_quote";
  base_price: number | null;
  min_price: number | null;
  max_price: number | null;
  duration_minutes: number | null;
  mobile_available: boolean;
  in_studio_available: boolean;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Stylist = {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  level: "new" | "standard" | "pro" | "elite" | "master";
  rating: number;
  total_bookings: number;
  specialties: string[];
  service_mode: "mobile" | "in_studio" | "both";
  on_duty: boolean;
  studio_name: string | null;
  studio_address: string | null;
  portfolio_urls: string[];
  instagram_handle: string | null;
  license_verified: boolean;
  id_verified: boolean;
  bg_check_passed: boolean;
  badges: string[];
};

export type Booking = {
  id: string;
  client_id: string;
  stylist_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  status: string;
  service_mode: "mobile" | "in_studio";
  estimated_price: number | null;
  final_price: number | null;
  booking_type: "on_demand" | "scheduled";
  scheduled_at: string | null;
  created_at: string;
};
