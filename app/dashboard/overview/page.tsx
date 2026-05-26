import Link from 'next/link'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { getAcademiaConfig } from '@/lib/queries/academia-config'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Dashboard overview hub — Server Component.
 *
 * Welcome card state (no tenant_config): shows CTA to configure.
 * Configured state (row exists): shows 3 placeholder counter cards.
 * Top bar: "VISAO GERAL" + tenant name per UI-SPEC § Screen /dashboard/overview.
 */
export default async function OverviewPage() {
  const [usuario, config] = await Promise.all([
    getCurrentUsuario(),
    getAcademiaConfig(),
  ])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
          Visao Geral
        </h1>
        <span className="text-sm text-[#64748B]">
          {config?.nome_academia ?? usuario?.nome ?? ''}
        </span>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {!config ? (
          /* Welcome card — no tenant_config yet */
          <Card className="border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <CardHeader className="px-0 pt-0 pb-4">
              <CardTitle className="text-xl font-bold text-[#0F172A]">
                Configure o DNA da sua academia
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <p className="mb-6 text-base text-[#64748B]">
                Para que o CMO autônomo trabalhe por você, precisamos conhecer
                sua academia.
              </p>
              <Link
                href="/dashboard/configuracoes"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#E30613] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C0040F]"
              >
                Configurar academia
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* Counter cards — tenant_config exists */
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#64748B] uppercase tracking-wider">
                  Leads
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <p className="text-3xl font-bold text-[#0F172A]">0</p>
              </CardContent>
            </Card>

            <Card className="border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#64748B] uppercase tracking-wider">
                  Agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <p className="text-3xl font-bold text-[#0F172A]">0</p>
              </CardContent>
            </Card>

            <Card className="border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <CardHeader className="px-0 pt-0 pb-2">
                <CardTitle className="text-sm font-medium text-[#64748B] uppercase tracking-wider">
                  Conteudos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <p className="text-3xl font-bold text-[#0F172A]">0</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
