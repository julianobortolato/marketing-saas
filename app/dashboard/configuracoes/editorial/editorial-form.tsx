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
  editorialConfigSchema,
  type EditorialConfigInput,
} from '@/lib/validators/editorial-config'
import { saveEditorialConfig } from './actions'

interface EditorialFormProps {
  initialValues?: Partial<EditorialConfigInput> | null
  role: 'owner' | 'manager' | 'viewer'
}

export function EditorialForm({ initialValues, role }: EditorialFormProps) {
  const [successMessage, setSuccessMessage] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const isViewer = role === 'viewer'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditorialConfigInput>({
    resolver: zodResolver(editorialConfigSchema),
    mode: 'onBlur',
    defaultValues: {
      caderno_editorial_escopo: initialValues?.caderno_editorial_escopo ?? '',
      caderno_editorial_tom: initialValues?.caderno_editorial_tom ?? '',
      caderno_editorial_restricoes:
        initialValues?.caderno_editorial_restricoes ?? '',
      caderno_editorial_objetivos:
        initialValues?.caderno_editorial_objetivos ?? [],
      caderno_editorial_exemplos:
        initialValues?.caderno_editorial_exemplos ?? '',
      palavras_proibidas: initialValues?.palavras_proibidas ?? [],
      persona_cmo: initialValues?.persona_cmo ?? '',
      gatilhos_handoff: initialValues?.gatilhos_handoff ?? undefined,
    },
  })

  async function onSubmit(data: EditorialConfigInput) {
    setServerError(null)
    const result = await saveEditorialConfig(data as unknown)

    if ('error' in result && result.error) {
      const msg =
        typeof result.error === 'string'
          ? result.error
          : 'Erro ao salvar. Tente novamente.'
      setServerError(msg)
      return
    }

    setSuccessMessage(true)
    setTimeout(() => setSuccessMessage(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-[720px]">
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Voz e Escopo
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="caderno_editorial_escopo">Escopo editorial</Label>
          <Textarea
            id="caderno_editorial_escopo"
            rows={6}
            readOnly={isViewer}
            placeholder="Tipo de conteúdo que o agente deve produzir e abordar"
            aria-invalid={!!errors.caderno_editorial_escopo}
            {...register('caderno_editorial_escopo')}
          />
          {errors.caderno_editorial_escopo && (
            <p className="text-sm text-destructive" role="alert">
              {errors.caderno_editorial_escopo.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caderno_editorial_tom">Tom de voz da comunicação</Label>
          <Textarea
            id="caderno_editorial_tom"
            rows={3}
            readOnly={isViewer}
            placeholder="Ex: Consultivo, próximo, motivador — sem usar gírias"
            aria-invalid={!!errors.caderno_editorial_tom}
            {...register('caderno_editorial_tom')}
          />
          {errors.caderno_editorial_tom && (
            <p className="text-sm text-destructive" role="alert">
              {errors.caderno_editorial_tom.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caderno_editorial_restricoes">O que NÃO falar</Label>
          <Textarea
            id="caderno_editorial_restricoes"
            rows={4}
            readOnly={isViewer}
            placeholder="Ex: Nunca mencionar concorrentes, não prometer desconto"
            aria-invalid={!!errors.caderno_editorial_restricoes}
            {...register('caderno_editorial_restricoes')}
          />
          {errors.caderno_editorial_restricoes && (
            <p className="text-sm text-destructive" role="alert">
              {errors.caderno_editorial_restricoes.message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Objetivos e Exemplos
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="caderno_editorial_objetivos">
            Objetivos do agente
          </Label>
          <Controller
            name="caderno_editorial_objetivos"
            control={control}
            render={({ field }) => (
              <TagInput
                id="caderno_editorial_objetivos"
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Ex: converter AE, qualificar lead, agendar visita..."
                disabled={isViewer}
              />
            )}
          />
          {errors.caderno_editorial_objetivos && (
            <p className="text-sm text-destructive" role="alert">
              {errors.caderno_editorial_objetivos.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caderno_editorial_exemplos">
            Exemplos de resposta
          </Label>
          <Textarea
            id="caderno_editorial_exemplos"
            rows={6}
            readOnly={isViewer}
            placeholder="Exemplo: quando o lead perguntar sobre preços, responder com..."
            aria-invalid={!!errors.caderno_editorial_exemplos}
            {...register('caderno_editorial_exemplos')}
          />
          {errors.caderno_editorial_exemplos && (
            <p className="text-sm text-destructive" role="alert">
              {errors.caderno_editorial_exemplos.message}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Guardrails
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="palavras_proibidas">
            Palavras proibidas (força handoff)
          </Label>
          <Controller
            name="palavras_proibidas"
            control={control}
            render={({ field }) => (
              <TagInput
                id="palavras_proibidas"
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Ex: barato, desconto, grátis..."
                disabled={isViewer}
              />
            )}
          />
          {errors.palavras_proibidas && (
            <p className="text-sm text-destructive" role="alert">
              {errors.palavras_proibidas.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="persona_cmo">
            Nome da persona do CMO (opcional)
          </Label>
          <Input
            id="persona_cmo"
            type="text"
            readOnly={isViewer}
            placeholder="Ex: Bruno, Carla, Assistente..."
            aria-invalid={!!errors.persona_cmo}
            {...register('persona_cmo')}
          />
          {errors.persona_cmo && (
            <p className="text-sm text-destructive" role="alert">
              {errors.persona_cmo.message}
            </p>
          )}
        </div>
      </section>

      {!isViewer && (
        <div className="flex flex-col items-end gap-2">
          {serverError && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}
          {successMessage && (
            <p className="text-sm text-[#16A34A]" role="status">
              Caderno editorial salvo com sucesso.
            </p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[160px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar caderno'
            )}
          </Button>
        </div>
      )}
    </form>
  )
}
