'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assumirConversa, reativarAgente } from '../actions'

interface ConversaActionsProps {
  conversaId: string
  iaAtiva: boolean
}

export function ConversaActions({ conversaId, iaAtiva }: ConversaActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          if (iaAtiva) {
            await assumirConversa(conversaId)
          } else {
            await reativarAgente(conversaId)
          }
          router.refresh()
        })
      }}
      className={[
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60',
        iaAtiva
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]',
      ].join(' ')}
    >
      {isPending
        ? 'Aguarde...'
        : iaAtiva
          ? 'Assumir conversa'
          : 'Reativar IA'}
    </button>
  )
}
