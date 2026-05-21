'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enviarMensagemManual } from '../actions'

interface ManualReplyFormProps {
  conversaId: string
}

export function ManualReplyForm({ conversaId }: ManualReplyFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const conteudo = textareaRef.current?.value ?? ''
    if (!conteudo.trim()) return

    setErrorMsg(null)
    startTransition(async () => {
      const result = await enviarMensagemManual(conversaId, conteudo)
      if ('error' in result && result.error) {
        setErrorMsg(result.error)
        return
      }
      if (textareaRef.current) textareaRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-[#E2E8F0] bg-white px-6 py-4"
    >
      {errorMsg && (
        <p className="mb-2 text-sm text-red-600">{errorMsg}</p>
      )}
      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          rows={2}
          disabled={isPending}
          placeholder="Responder como atendente..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          className="flex-1 resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B] disabled:opacity-60"
        >
          {isPending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-[#94A3B8]">Enter para enviar · Shift+Enter para nova linha</p>
    </form>
  )
}
