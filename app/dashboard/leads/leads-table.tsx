'use client'

import { useTransition, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Lead } from '@/lib/queries/leads'
import type { UsuarioRole } from '@/lib/queries/usuario'
import { updateLeadStatus } from './actions'

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  agendado: 'Agendado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

const ORIGEM_LABELS: Record<string, string> = {
  meta_form: 'Meta Form',
  whatsapp: 'WhatsApp',
  google: 'Google',
  manual: 'Manual',
}

const STATUSES = ['novo', 'contatado', 'agendado', 'convertido', 'perdido']

interface LeadsTableProps {
  leads: Lead[]
  role: UsuarioRole
}

function StatusCell({
  lead,
  canWrite,
}: {
  lead: Lead
  canWrite: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [rowError, setRowError] = useState<string | null>(null)

  if (!canWrite) {
    return (
      <Badge className="border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-normal">
        {STATUS_LABELS[lead.status] ?? lead.status}
      </Badge>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        defaultValue={lead.status}
        disabled={isPending}
        onChange={(e) => {
          setRowError(null)
          startTransition(async () => {
            const result = await updateLeadStatus({ id: lead.id, status: e.target.value })
            if (result && 'error' in result) {
              setRowError(typeof result.error === 'string' ? result.error : 'Erro ao atualizar.')
            }
          })
        }}
        className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613] disabled:opacity-60"
        aria-label="Alterar status do lead"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {rowError && <p className="text-xs text-red-600">{rowError}</p>}
    </div>
  )
}

export function LeadsTable({ leads, role }: LeadsTableProps) {
  const canWrite = role !== 'viewer'

  if (leads.length === 0) {
    return (
      <Card className="border-[#E2E8F0] bg-[#F8FAFC]">
        <CardContent className="p-6 text-center text-[#64748B]">
          Nenhum lead ainda.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-xs tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Nome</th>
            <th className="px-4 py-3 text-left font-medium">Telefone</th>
            <th className="px-4 py-3 text-left font-medium">Canal</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Criado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] bg-white">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-[#F8FAFC] transition-colors">
              <td className="px-4 py-3 text-[#0F172A]">
                {lead.nome ?? <span className="text-[#64748B]">—</span>}
              </td>
              <td className="px-4 py-3 text-[#0F172A]">
                {lead.telefone ?? <span className="text-[#64748B]">—</span>}
              </td>
              <td className="px-4 py-3">
                <Badge className="border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-normal">
                  {ORIGEM_LABELS[lead.origem] ?? lead.origem}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <StatusCell lead={lead} canWrite={canWrite} />
              </td>
              <td className="px-4 py-3 text-[#64748B]">
                {new Date(lead.criado_em).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
