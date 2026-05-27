// ═══════════════════════════════════════════════════════════════
// lib/supabase-client.ts — Browser-side Supabase client
// ═══════════════════════════════════════════════════════════════
// Used in:
//   • Client components ('use client') that need to call auth methods
//     (sign in, sign out, listen to auth state changes)
//
// Singleton pattern — one instance per browser tab/window.

'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // PKCE flow stores the code verifier in cookies (not localStorage) so
        // the server-side /auth/callback route can read it. Without this,
        // magic links fail with "PKCE code verifier not found in storage".
        flowType: 'pkce',
      },
    },
  )
  return client
}
