'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { BancoImagemRow } from '@/lib/queries/banco-imagens'
import { aprovarImagem, rejeitarImagem, deletarImagens } from './actions'

export interface ImagemComUrl extends BancoImagemRow {
  signedUrl: string | null
}

interface GaleriaProps {
  imagens: ImagemComUrl[]
}

export function Galeria({ imagens }: GaleriaProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggleSelecionada(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleAprovar(id: string) {
    startTransition(async () => {
      const result = await aprovarImagem(id)
      if (result.error) setError(result.error)
    })
  }

  function handleRejeitar(id: string) {
    startTransition(async () => {
      const result = await rejeitarImagem(id)
      if (result.error) setError(result.error)
    })
  }

  function handleDeletar() {
    if (selecionadas.size === 0) return
    startTransition(async () => {
      const result = await deletarImagens(Array.from(selecionadas))
      if (result.error) {
        setError(result.error)
      } else {
        setSelecionadas(new Set())
      }
    })
  }

  if (imagens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[var(--text-muted)]">Nenhuma imagem no banco ainda.</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Faça upload de imagens no wizard de onboarding (passo 5).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {selecionadas.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2">
          <span className="text-sm text-[var(--text-muted)]">
            {selecionadas.size} selecionada{selecionadas.size > 1 ? 's' : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleDeletar}
            className="ml-auto gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 size={14} />
            Excluir selecionadas
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {imagens.map((img) => (
          <div
            key={img.id}
            className={[
              'group relative overflow-hidden rounded-xl border transition',
              selecionadas.has(img.id) ? 'border-[var(--prisma-midnight)] ring-2 ring-[var(--prisma-midnight)]' : 'border-border',
            ].join(' ')}
          >
            {/* Checkbox overlay */}
            <label className="absolute left-2 top-2 z-10 cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={selecionadas.has(img.id)}
                onChange={() => toggleSelecionada(img.id)}
              />
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center rounded border-2 bg-white transition',
                  selecionadas.has(img.id)
                    ? 'border-[var(--prisma-midnight)] bg-[var(--prisma-midnight)]'
                    : 'border-white/80 opacity-0 group-hover:opacity-100',
                ].join(' ')}
              >
                {selecionadas.has(img.id) && (
                  <CheckCircle2 size={12} className="text-white" />
                )}
              </span>
            </label>

            {/* Status badge */}
            <div className="absolute right-2 top-2 z-10">
              {img.aprovada ? (
                <span className="rounded-full bg-[var(--prisma-success)] px-2 py-0.5 text-[10px] font-medium text-white">
                  Aprovada
                </span>
              ) : (
                <span className="rounded-full bg-[var(--text-muted)]/70 px-2 py-0.5 text-[10px] font-medium text-white">
                  Pendente
                </span>
              )}
            </div>

            {/* Image */}
            <div className="aspect-square bg-card">
              {img.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.signedUrl}
                  alt={img.categoria}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                  Sem preview
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 space-y-1.5">
              <p className="truncate text-xs font-medium text-[var(--text-main)]">
                {img.categoria}
              </p>
              {img.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {img.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                  {img.tags.length > 3 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      +{img.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-1.5 pt-0.5">
                {!img.aprovada && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleAprovar(img.id)}
                    className="h-7 flex-1 gap-1 text-xs text-[var(--prisma-success)]"
                  >
                    <CheckCircle2 size={12} />
                    Aprovar
                  </Button>
                )}
                {img.aprovada && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleRejeitar(img.id)}
                    className="h-7 flex-1 gap-1 text-xs text-[var(--text-muted)]"
                  >
                    <XCircle size={12} />
                    Rejeitar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
