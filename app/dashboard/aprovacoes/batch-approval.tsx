'use client'

import { useTransition, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { approveBatch, rejectBatch, AgendamentoInfo } from './actions'

interface BatchApprovalProps {
  ids: string[]
}

const CANCEL_WINDOW_MS = 5 * 60 * 1000 // 5 minutos

function formatAgendadoPara(isoStr: string): string {
  const date = new Date(isoStr)
  return date.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function BatchApproval({ ids }: BatchApprovalProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [agendamentos, setAgendamentos] = useState<AgendamentoInfo[]>([])
  const [cancelWindow, setCancelWindow] = useState(false)
  const [cancelando, setCancelando] = useState<string | null>(null)

  // Janela de cancelamento de 5 minutos após aprovação
  useEffect(() => {
    if (!cancelWindow) return
    const timer = setTimeout(() => setCancelWindow(false), CANCEL_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [cancelWindow])

  const handleCancelar = useCallback(async (conteudoId: string) => {
    setCancelando(conteudoId)
    try {
      const res = await fetch(`/api/conteudos/${conteudoId}/cancelar-agendamento`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAgendamentos((prev) => prev.filter((a) => a.conteudo_id !== conteudoId))
        setMessage({ text: 'Agendamento cancelado. Post voltou para aprovados.', type: 'success' })
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage({ text: (data.error as string) || 'Erro ao cancelar.', type: 'error' })
      }
    } catch {
      setMessage({ text: 'Erro ao cancelar agendamento.', type: 'error' })
    } finally {
      setCancelando(null)
    }
  }, [])

  function handleApprove() {
    setMessage(null)
    setAgendamentos([])
    startTransition(async () => {
      const result = await approveBatch({ ids })
      if (result && 'error' in result) {
        const msg = typeof result.error === 'string' ? result.error : 'Erro ao aprovar.'
        setMessage({ text: msg, type: 'error' })
      } else if (result && 'agendamentos' in result && result.agendamentos?.length) {
        setAgendamentos(result.agendamentos as AgendamentoInfo[])
        setCancelWindow(true)
        setMessage({ text: `${result.count} post(s) aprovado(s) e agendado(s).`, type: 'success' })
      } else {
        setMessage({ text: 'Lote aprovado. Agendamento não disponível (Zernio não configurado).', type: 'success' })
      }
    })
  }

  function handleReject() {
    setMessage(null)
    startTransition(async () => {
      const result = await rejectBatch({ ids })
      if (result && 'error' in result) {
        const msg = typeof result.error === 'string' ? result.error : 'Erro ao rejeitar.'
        setMessage({ text: msg, type: 'error' })
      } else {
        setMessage({ text: 'Lote rejeitado.', type: 'success' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleApprove}
          disabled={isPending}
          className="bg-[#E30613] hover:bg-[#C0040F] text-white min-w-[140px]"
        >
          {isPending ? 'Processando...' : 'Aprovar lote'}
        </Button>

        <Button
          onClick={handleReject}
          disabled={isPending}
          variant="outline"
          className="border-[#E2E8F0] text-[#0F172A] min-w-[140px]"
        >
          {isPending ? 'Processando...' : 'Rejeitar lote'}
        </Button>
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-[#16A34A]' : 'text-red-600'}`}
          role={message.type === 'success' ? 'status' : 'alert'}
        >
          {message.text}
        </p>
      )}

      {/* Agendamentos com janela de cancelamento (5 min) */}
      {cancelWindow && agendamentos.length > 0 && (
        <div className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Agendados — cancele em até 5 min
          </p>
          {agendamentos.map((a) => (
            <div key={a.conteudo_id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#0F172A]">
                Agendado para{' '}
                <span className="font-medium">{formatAgendadoPara(a.agendado_para)}</span>
              </span>
              <button
                onClick={() => handleCancelar(a.conteudo_id)}
                disabled={cancelando === a.conteudo_id}
                className="text-xs text-red-600 underline hover:no-underline disabled:opacity-50"
              >
                {cancelando === a.conteudo_id ? 'Cancelando...' : 'Cancelar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
