import type { NextConfig } from 'next'

// Supabase publishable keys are intentionally public client identifiers.
// This versioned binding prevents silent project drift while Vercel environment
// values can still override it for an approved future migration.
const approvedProjectRef = 'dzlmtvodpyhetvektfuo'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${approvedProjectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_ekvoOK6QQ05dUZuWgzQfUw_2RgbWPFR',
    NEXT_PUBLIC_SUPABASE_PROJECT_REF:
      process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || approvedProjectRef,
  },
}

export default nextConfig
