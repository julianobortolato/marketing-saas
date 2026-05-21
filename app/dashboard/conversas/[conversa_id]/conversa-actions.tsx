'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assumirConversa, reativarAgente } from '../actions'

interface ConversaActionsProps {
  conversaId: string
  iaAtiva: boolean
}

export function ConversaActions({ conversaId, iaAtiva }: ConversaActionsProps) {
  const [localIaAtiva, setLocalIaAtiva] = useState(iaAtiva)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          if (localIaAtiva) {
            const res = await assumirConversa(conversaId)
            if (!res.error) setLocalIaAtiva(false)
          } else {
            const res = await reativarAgente(conversaId)
            if (!res.error) setLocalIaAtiva(true)
          }
          router.refresh()
        })
      }}
      className={[
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60',
        localIaAtiva
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]',
      ].join(' ')}
    >
      {isPending
        ? 'Aguarde...'
        : localIaAtiva
          ? 'Assumir conversa'
          : 'Reativar IA'}
    </button>
  )
}
