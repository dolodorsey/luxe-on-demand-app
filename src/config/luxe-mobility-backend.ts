// LUXE shares the physical Supabase project used by ON CALL, while remaining logically isolated under the lm_* namespace.
// ON CALL continues to use oc_* tables/functions; LUXE mobility uses lm_* tables/functions.
export const LUXE_MOBILITY_PROJECT_REF = 'wfkohcwxxsrhcxhepfql'
export const LUXE_MOBILITY_SUPABASE_URL = `https://${LUXE_MOBILITY_PROJECT_REF}.supabase.co`
export const LUXE_MOBILITY_PUBLISHABLE_KEY = 'sb_publishable_zKej0f4ql6VSR9rtHXaU0w_0yhVNAGL'
export const LUXE_BACKEND_MODE = 'shared-on-call-project' as const
