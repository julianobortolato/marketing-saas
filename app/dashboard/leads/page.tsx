import { getLeads } from '@/lib/queries/leads'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { Card, CardContent } from '@/components/ui/card'
import { LeadFilters } from './lead-filters'
import { LeadsTable } from './leads-table'
import { NewLeadDialog } from './new-lead-dialog'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = {
    status: typeof params.status === 'string' ? params.status : undefined,
    origem: typeof params.origem === 'string' ? params.origem : undefined,
    from: typeof params.from === 'string' ? params.from : undefined,
    to: typeof params.to === 'string' ? params.to : undefined,
  }

  const [leads, usuario] = await Promise.all([
    getLeads(filters),
    getCurrentUsuario(),
  ])

  const role = usuario?.role ?? 'viewer'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
          Leads
        </h1>
        {role !== 'viewer' && <NewLeadDialog />}
      </header>

      {/* Filters */}
      <div className="border-b border-[#E2E8F0] px-6 py-3">
        <LeadFilters current={filters} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {leads.length === 0 ? (
          <Card className="border-[#E2E8F0] bg-[#F8FAFC]">
            <CardContent className="p-6 text-center text-[#64748B]">
              {Object.values(filters).some(Boolean)
                ? 'Nenhum lead corresponde aos filtros.'
                : 'Nenhum lead ainda.'}
            </CardContent>
          </Card>
        ) : (
          <LeadsTable leads={leads} role={role} />
        )}
      </div>
    </div>
  )
}
