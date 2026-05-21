'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Conversa } from '@/lib/queries/conversas'
import type { UsuarioRole } from '@/lib/queries/usuario'
import { assumirConversa, reativarAgente } from './actions'

interface ConversasTableProps {
  conversas: Conversa[]
  role: UsuarioRole
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

function maskRemotejid(remotejid: string): string {
  const number = remotejid.replace(/@.*$/, '')
  if (number.length <= 4) return number
  return `...${number.slice(-4)}`
}

function HandoffCell({
  conversa,
  canMutate,
}: {
  conversa: Conversa
  canMutate: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (!canMutate) {
    return (
      <Badge
        className={
          conversa.ia_ativa
            ? 'border-transparent bg-green-100 text-green-800 font-normal'
            : 'border-transparent bg-amber-100 text-amber-800 font-normal'
        }
      >
        {conversa.ia_ativa ? 'IA Ativa' : 'Humano'}
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        className={
          conversa.ia_ativa
            ? 'border-transparent bg-green-100 text-green-800 font-normal'
            : 'border-transparent bg-amber-100 text-amber-800 font-normal'
        }
      >
        {conversa.ia_ativa ? 'IA Ativa' : 'Humano'}
      </Badge>
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            if (conversa.ia_ativa) {
              await assumirConversa(conversa.id)
            } else {
              await reativarAgente(conversa.id)
            }
          })
        }}
        className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
      >
        {conversa.ia_ativa ? 'Assumir' : 'Reativar IA'}
      </button>
    </div>
  )
}

export function ConversasTable({ conversas, role }: ConversasTableProps) {
  const canMutate = role === 'owner' || role === 'manager'

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-xs tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Lead</th>
            <th className="px-4 py-3 text-left font-medium">Número</th>
            <th className="px-4 py-3 text-left font-medium">Última mensagem</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] bg-white">
          {conversas.map((conversa) => (
            <tr
              key={conversa.id}
              className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 text-[#0F172A]">
                <Link
                  href={`/dashboard/conversas/${conversa.id}`}
                  className="block"
                >
                  {conversa.leads?.nome ?? (
                    <span className="text-[#64748B]">
                      {conversa.leads?.telefone ?? '—'}
                    </span>
                  )}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#64748B] font-mono text-xs">
                <Link
                  href={`/dashboard/conversas/${conversa.id}`}
                  className="block"
                >
                  {maskRemotejid(conversa.remotejid)}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#64748B]">
                <Link
                  href={`/dashboard/conversas/${conversa.id}`}
                  className="block"
                >
                  {formatRelativeTime(conversa.ultima_mensagem_em)}
                </Link>
              </td>
              <td className="px-4 py-3">
                <HandoffCell conversa={conversa} canMutate={canMutate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
