import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { AppShell } from '@/components/app-shell'

/**
 * Dashboard route-group layout — Server Component.
 * Auth guard (defense-in-depth alongside middleware):
 * - Uses getUser() to revalidate session against the Supabase auth server on every request.
 * - Redirects to /login when no authenticated user.
 * Renders AppShell with role-aware sidebar for all /dashboard/* routes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const usuario = await getCurrentUsuario()

  if (!usuario) {
    // Edge case: auth user exists but no usuarios row yet (trigger delay).
    // Redirect to login to re-authenticate cleanly.
    redirect('/login')
  }

  return <AppShell usuario={usuario}>{children}</AppShell>
}
