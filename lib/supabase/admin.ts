import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client — API routes ONLY. NEVER import in Client Components or Server Components.
// The 'server-only' import above causes a build error if imported from Client Component paths.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only env var — never in client bundle
  )
}
