// LUXE mobility shares the SOS/ON CALL Supabase project while remaining logically isolated under lm_*.
// This file is the single reviewed public binding for the mobility client. The publishable key is intentionally public;
// service-role and Stripe credentials remain server-side only.
export const LUXE_MOBILITY_PROJECT_REF = 'cxdqkjvtpilvouwtbgdy'
export const LUXE_MOBILITY_SUPABASE_URL = `https://${LUXE_MOBILITY_PROJECT_REF}.supabase.co`
export const LUXE_MOBILITY_PUBLISHABLE_KEY = 'sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN'
export const LUXE_BACKEND_MODE = 'shared-sos-on-call-project' as const

// Current approved LUXE motion lives in the central Creative Engine animation library.
export const LUXE_CURRENT_MOTION = 'https://woqlhjodiedyqfvzweoe.supabase.co/storage/v1/object/public/animations/luxe-on-demand-ani.mp4'
