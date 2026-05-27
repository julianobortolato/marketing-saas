import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { getTenant } from '@/lib/queries/tenant'
import { AppShell } from '@/components/app-shell'

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

  const [usuario, tenant] = await Promise.all([
    getCurrentUsuario(),
    getTenant(),
  ])

  if (!usuario) {
    redirect('/api/auth/signout')
  }

  // Wizard gate: user must complete all 8 steps before accessing the dashboard.
  // onboarding_passo >= 9 means the wizard was concluded (concludeOnboarding sets 9).
  if (tenant && tenant.onboarding_passo < 9) {
    redirect(`/onboarding/${Math.max(tenant.onboarding_passo, 1)}`)
  }

  return <AppShell usuario={usuario}>{children}</AppShell>
}
