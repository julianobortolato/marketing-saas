'use client'

import { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { approveBatch, rejectBatch } from './actions'

interface BatchApprovalProps {
  ids: string[]
}

export function BatchApproval({ ids }: BatchApprovalProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function handleApprove() {
    setMessage(null)
    startTransition(async () => {
      const result = await approveBatch({ ids })
      if (result && 'error' in result) {
        const msg = typeof result.error === 'string' ? result.error : 'Erro ao aprovar.'
        setMessage({ text: msg, type: 'error' })
      } else {
        setMessage({ text: 'Lote aprovado.', type: 'success' })
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
        {/* Approve — primary CTA, red per CLAUDE.md 60-30-10 */}
        <Button
          onClick={handleApprove}
          disabled={isPending}
          className="bg-[#E30613] hover:bg-[#C0040F] text-white min-w-[140px]"
        >
          {isPending ? 'Processando...' : 'Aprovar lote'}
        </Button>

        {/* Reject — neutral/outline, not red */}
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
    </div>
  )
}
