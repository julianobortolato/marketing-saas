import { getWeeklyOrganicBatch, getConteudosAprovados } from '@/lib/queries/aprovacoes'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BatchApproval } from './batch-approval'
import { DownloadButton } from './download-button'

export const dynamic = 'force-dynamic'

export default async function AprovacoesPage() {
  const [batch, aprovados, usuario] = await Promise.all([
    getWeeklyOrganicBatch(),
    getConteudosAprovados(),
    getCurrentUsuario(),
  ])

  const role = usuario?.role ?? 'viewer'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
            Aprovações
          </h1>
          <span className="text-sm text-[#64748B]">Lote semanal — até 10 posts orgânicos</span>
        </div>
        <Badge className="border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]">
          {batch.length} de 10
        </Badge>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {batch.length === 0 ? (
          <Card className="border-[#E2E8F0] bg-[#F8FAFC]">
            <CardContent className="p-6 text-center text-[#64748B]">
              Nenhum post aguardando aprovação.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Referência</th>
                    <th className="px-4 py-3 text-left font-medium">Criado em</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white">
                  {batch.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-[#64748B]">
                        {item.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#64748B]">
                        {item.referencia_id ? item.referencia_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {new Date(item.criado_em).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-normal">
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {role !== 'viewer' && (
              <BatchApproval ids={batch.map((b) => b.id)} />
            )}
          </div>
        )}
      </div>

      {/* Prontos para download */}
      {aprovados.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#0F172A] mb-3">
            Prontos para baixar
          </h2>
          <p className="text-xs text-[#64748B] mb-4">
            Baixe o ZIP, extraia e publique no Instagram manualmente.
          </p>
          <div className="space-y-2">
            {aprovados.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-[#64748B]">
                    {c.id.slice(0, 8)}…
                  </span>
                  {c.copy_principal && (
                    <span className="text-sm text-[#0F172A] line-clamp-1 max-w-md">
                      {c.copy_principal}
                    </span>
                  )}
                </div>
                {role !== 'viewer' && (
                  <DownloadButton conteudoId={c.id} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
