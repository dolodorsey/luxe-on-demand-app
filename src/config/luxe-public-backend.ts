// Supabase publishable keys are public client identifiers, not service-role secrets.
// Keep this binding versioned so LUXE cannot silently drift to another backend.
export const LUXE_APPROVED_PROJECT_REF = 'dzlmtvodpyhetvektfuo'
export const LUXE_APPROVED_SUPABASE_URL = `https://${LUXE_APPROVED_PROJECT_REF}.supabase.co`
export const LUXE_APPROVED_PUBLISHABLE_KEY = 'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR'
