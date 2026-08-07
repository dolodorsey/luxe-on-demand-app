// LUXE mobility closure branch uses the enterprise staging project only for controlled QA.
// Production must move to a dedicated LUXE Supabase project before this branch can be promoted.
// Supabase publishable keys are public client identifiers, not service-role secrets.
export const LUXE_APPROVED_PROJECT_REF = 'ofjsmkwasvztxjdzjvvf'
export const LUXE_APPROVED_SUPABASE_URL = `https://${LUXE_APPROVED_PROJECT_REF}.supabase.co`
export const LUXE_APPROVED_PUBLISHABLE_KEY = 'sb_publishable_kSWX1jfcv21s0a3EdFZ2TQ_Wy7oNA8r'
export const LUXE_BACKEND_MODE = 'controlled-staging' as const
