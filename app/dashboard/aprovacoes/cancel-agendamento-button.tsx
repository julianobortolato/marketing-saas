'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface CancelAgendamentoButtonProps {
  conteudoId: string
}

export function CancelAgendamentoButton({ conteudoId }: CancelAgendamentoButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleCancel() {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/conteudos/${conteudoId}/cancelar-agendamento`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data.error as string) || 'Erro ao cancelar.')
      }
    } catch {
      setError('Erro ao cancelar agendamento.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleCancel}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="border-red-200 text-red-600 hover:bg-red-50"
      >
        {isLoading ? 'Cancelando...' : 'Cancelar'}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
