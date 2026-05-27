'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TagInput } from '@/components/tag-input'
import {
  marcaFormSchema,
  FONTES_CURADAS,
  type MarcaFormValues,
} from '@/lib/validators/marca'
import type { BrandManual } from '@/lib/queries/brand-manual'
import { saveMarca } from './actions'

interface MarcaFormProps {
  brandManual: BrandManual
}

export function MarcaForm({ brandManual }: MarcaFormProps) {
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const v = brandManual.visual ?? {}
  const t = brandManual.tom_de_voz ?? {}
  const p = brandManual.publico_alvo ?? {}

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<MarcaFormValues>({
    resolver: zodResolver(marcaFormSchema),
    mode: 'onBlur',
    defaultValues: {
      visual: {
        cor_primaria: v.cor_primaria ?? '#1A2E4A',
        cor_secundaria: v.cor_secundaria ?? '#7B61C4',
        fonte_titulo: v.fonte_titulo ?? 'Plus Jakarta Sans',
        fonte_corpo: v.fonte_corpo ?? 'Inter',
      },
      tom_de_voz: {
        descricao: t.descricao ?? '',
        tom: t.tom ?? '',
        temas_recorrentes: t.temas_recorrentes ?? [],
        frequencia: t.frequencia ?? '',
        palavras_preferidas: t.palavras_preferidas ?? [],
        palavras_a_evitar: t.palavras_a_evitar ?? [],
      },
      publico_alvo: {
        descricao: p.descricao ?? '',
        diferencial: p.diferencial ?? '',
      },
    },
  })

  async function onSubmit(data: MarcaFormValues) {
    setServerError(null)
    const result = await saveMarca(data)
    if (result.error) {
      setServerError(result.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Build font options — include current value even if not in curated list
  const allFontes = Array.from(
    new Set([
      ...FONTES_CURADAS,
      ...(v.fonte_titulo ? [v.fonte_titulo] : []),
      ...(v.fonte_corpo ? [v.fonte_corpo] : []),
    ])
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-[720px]">

      {/* ── Visual ── */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Visual
        </h2>

        {v.logo_url && (
          <div className="space-y-1.5">
            <Label>Logo</Label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.logo_url} alt="Logo da marca" className="h-16 w-auto rounded-lg border object-contain" />
            <p className="text-xs text-[var(--text-muted)]">
              Para trocar o logo, entre em contato com o suporte.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cor_primaria">Cor primária</Label>
            <div className="flex items-center gap-2">
              <input
                id="cor_primaria"
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-input p-1"
                {...register('visual.cor_primaria')}
              />
              <Input
                className="font-mono uppercase"
                aria-label="Hex cor primária"
                {...register('visual.cor_primaria')}
              />
            </div>
            {errors.visual?.cor_primaria && (
              <p className="text-sm text-destructive" role="alert">
                {errors.visual.cor_primaria.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cor_secundaria">Cor secundária</Label>
            <div className="flex items-center gap-2">
              <input
                id="cor_secundaria"
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-input p-1"
                {...register('visual.cor_secundaria')}
              />
              <Input
                className="font-mono uppercase"
                aria-label="Hex cor secundária"
                {...register('visual.cor_secundaria')}
              />
            </div>
            {errors.visual?.cor_secundaria && (
              <p className="text-sm text-destructive" role="alert">
                {errors.visual.cor_secundaria.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fonte_titulo">Fonte título</Label>
            <select
              id="fonte_titulo"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('visual.fonte_titulo')}
            >
              {allFontes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {errors.visual?.fonte_titulo && (
              <p className="text-sm text-destructive" role="alert">
                {errors.visual.fonte_titulo.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fonte_corpo">Fonte corpo</Label>
            <select
              id="fonte_corpo"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('visual.fonte_corpo')}
            >
              {allFontes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {errors.visual?.fonte_corpo && (
              <p className="text-sm text-destructive" role="alert">
                {errors.visual.fonte_corpo.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Tom de Voz ── */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Tom de voz
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="descricao_tdv">Descrição</Label>
          <Textarea
            id="descricao_tdv"
            rows={3}
            placeholder="Como a sua marca se comunica com o público"
            aria-invalid={!!errors.tom_de_voz?.descricao}
            {...register('tom_de_voz.descricao')}
          />
          {errors.tom_de_voz?.descricao && (
            <p className="text-sm text-destructive" role="alert">
              {errors.tom_de_voz.descricao.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tom">Tom</Label>
            <Input
              id="tom"
              placeholder="Ex: motivador, direto, inspirador"
              {...register('tom_de_voz.tom')}
            />
            {errors.tom_de_voz?.tom && (
              <p className="text-sm text-destructive" role="alert">
                {errors.tom_de_voz.tom.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="frequencia">Frequência de postagem</Label>
            <Input
              id="frequencia"
              placeholder="Ex: 3x por semana"
              {...register('tom_de_voz.frequencia')}
            />
            {errors.tom_de_voz?.frequencia && (
              <p className="text-sm text-destructive" role="alert">
                {errors.tom_de_voz.frequencia.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Temas recorrentes</Label>
          <Controller
            name="tom_de_voz.temas_recorrentes"
            control={control}
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="Ex: Transformação, Superação, Resultados..."
              />
            )}
          />
          {errors.tom_de_voz?.temas_recorrentes && (
            <p className="text-sm text-destructive" role="alert">
              {errors.tom_de_voz.temas_recorrentes.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Palavras preferidas</Label>
            <Controller
              name="tom_de_voz.palavras_preferidas"
              control={control}
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ex: Conquista, Evolução..."
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Palavras a evitar</Label>
            <Controller
              name="tom_de_voz.palavras_a_evitar"
              control={control}
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ex: Caro, Difícil..."
                />
              )}
            />
          </div>
        </div>
      </section>

      {/* ── Público Alvo ── */}
      <section className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Público alvo
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="publico_descricao">Descrição do público</Label>
          <Textarea
            id="publico_descricao"
            rows={3}
            placeholder="Ex: Homens e mulheres entre 25-45 anos que buscam mudança de estilo de vida"
            aria-invalid={!!errors.publico_alvo?.descricao}
            {...register('publico_alvo.descricao')}
          />
          {errors.publico_alvo?.descricao && (
            <p className="text-sm text-destructive" role="alert">
              {errors.publico_alvo.descricao.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="publico_diferencial">Diferencial percebido</Label>
          <Textarea
            id="publico_diferencial"
            rows={3}
            placeholder="Ex: Atendimento personalizado com acompanhamento de evolução mensal"
            aria-invalid={!!errors.publico_alvo?.diferencial}
            {...register('publico_alvo.diferencial')}
          />
          {errors.publico_alvo?.diferencial && (
            <p className="text-sm text-destructive" role="alert">
              {errors.publico_alvo.diferencial.message}
            </p>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="flex flex-col items-end gap-2 border-t border-border pt-6">
        {serverError && (
          <p className="text-sm text-destructive" role="alert">{serverError}</p>
        )}
        {saved && (
          <p className="text-sm text-[var(--prisma-success)]" role="status">
            Manual de marca salvo.
          </p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="min-w-[180px] bg-[var(--prisma-midnight)] text-white hover:opacity-90"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando...</>
          ) : (
            'Salvar manual de marca'
          )}
        </Button>
      </div>
    </form>
  )
}
