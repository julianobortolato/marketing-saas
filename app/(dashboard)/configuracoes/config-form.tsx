'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { TagInput } from '@/components/tag-input'
import {
  academiaConfigSchema,
  type AcademiaConfigInput,
  type AcademiaConfigFormValues,
} from '@/lib/validators/academia-config'
import { saveAcademiaConfig } from './actions'

interface ConfigFormProps {
  initialValues?: Partial<AcademiaConfigInput> | null
  role: 'owner' | 'manager' | 'viewer'
}

const TOM_OPTIONS = [
  {
    value: 'formal',
    label: 'Formal',
    description: 'Comunicação profissional e respeitosa',
  },
  {
    value: 'neutro',
    label: 'Neutro',
    description: 'Equilibrado, direto e claro',
  },
  {
    value: 'coloquial',
    label: 'Coloquial',
    description: 'Descontraído, próximo e motivador',
  },
] as const

export function ConfigForm({ initialValues, role }: ConfigFormProps) {
  const [successMessage, setSuccessMessage] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const isViewer = role === 'viewer'

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<AcademiaConfigFormValues>({
    resolver: zodResolver(academiaConfigSchema),
    mode: 'onBlur',
    defaultValues: {
      nome_academia: initialValues?.nome_academia ?? '',
      bairro: initialValues?.bairro ?? '',
      cidade: initialValues?.cidade ?? '',
      raio_km: initialValues?.raio_km ?? 5,
      tom_de_voz: initialValues?.tom_de_voz ?? 'neutro',
      diferenciais: initialValues?.diferenciais ?? [],
      horarios: initialValues?.horarios ?? '',
      planos: initialValues?.planos ?? '',
    },
  })

  async function onSubmit(data: AcademiaConfigFormValues) {
    setServerError(null)
    // Cast to unknown — saveAcademiaConfig accepts unknown and validates server-side
    const result = await saveAcademiaConfig(data as unknown)

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
      {/* Section 1 — Identidade */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Identidade
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="nome_academia">
            Nome da academia{' '}
            <span className="text-[#E30613]" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="nome_academia"
            type="text"
            readOnly={isViewer}
            aria-invalid={!!errors.nome_academia}
            aria-describedby={
              errors.nome_academia ? 'nome_academia_error' : undefined
            }
            {...register('nome_academia')}
          />
          {errors.nome_academia && (
            <p
              id="nome_academia_error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.nome_academia.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bairro">
            Bairro{' '}
            <span className="text-[#E30613]" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="bairro"
            type="text"
            readOnly={isViewer}
            aria-invalid={!!errors.bairro}
            aria-describedby={errors.bairro ? 'bairro_error' : undefined}
            {...register('bairro')}
          />
          <p className="text-sm text-muted-foreground">
            Bairro principal onde sua academia opera
          </p>
          {errors.bairro && (
            <p
              id="bairro_error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.bairro.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cidade">
            Cidade{' '}
            <span className="text-[#E30613]" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="cidade"
            type="text"
            readOnly={isViewer}
            aria-invalid={!!errors.cidade}
            aria-describedby={errors.cidade ? 'cidade_error' : undefined}
            {...register('cidade')}
          />
          {errors.cidade && (
            <p
              id="cidade_error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.cidade.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="raio_km">Raio de atuação (km)</Label>
          <div className="relative flex items-center">
            <Input
              id="raio_km"
              type="number"
              min={1}
              max={50}
              readOnly={isViewer}
              className="pr-10"
              aria-invalid={!!errors.raio_km}
              aria-describedby={errors.raio_km ? 'raio_km_error' : undefined}
              {...register('raio_km')}
            />
            <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">
              km
            </span>
          </div>
          {errors.raio_km && (
            <p
              id="raio_km_error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.raio_km.message}
            </p>
          )}
        </div>
      </section>

      {/* Section 2 — Tom de voz */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Tom de voz
        </h2>

        <Controller
          name="tom_de_voz"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-label="Tom de voz"
            >
              {TOM_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  htmlFor={`tom_${opt.value}`}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                    field.value === opt.value
                      ? 'border-[#E30613] bg-[#FFF5F5]'
                      : 'border-border',
                    isViewer ? 'pointer-events-none opacity-60' : '',
                  ].join(' ')}
                >
                  <RadioGroupItem
                    id={`tom_${opt.value}`}
                    value={opt.value}
                    disabled={isViewer}
                  />
                  <div>
                    <p className="font-medium text-foreground">{opt.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </section>

      {/* Section 3 — Diferenciais */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Diferenciais
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="diferenciais">Diferenciais da academia</Label>
          <Controller
            name="diferenciais"
            control={control}
            render={({ field }) => (
              <TagInput
                id="diferenciais"
                value={field.value ?? []}
                onChange={field.onChange}
                placeholder="Ex: Musculação, Crossfit, Personal Trainer, Sauna..."
                disabled={isViewer}
              />
            )}
          />
          <p className="text-sm text-muted-foreground">
            Ex: Musculação, Crossfit, Personal Trainer, Sauna, Estacionamento
          </p>
        </div>
      </section>

      {/* Section 4 — Horários e Planos */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold uppercase tracking-wider text-foreground">
          Horários e Planos
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="horarios">Horários de funcionamento</Label>
          <Textarea
            id="horarios"
            rows={4}
            readOnly={isViewer}
            placeholder="Ex: Seg-Sex 06h-22h / Sab 08h-18h / Dom fechado"
            {...register('horarios')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="planos">Planos oferecidos</Label>
          <Textarea
            id="planos"
            rows={4}
            readOnly={isViewer}
            placeholder="Ex: Mensal R$120, Trimestral R$300, Anual R$900"
            {...register('planos')}
          />
        </div>
      </section>

      {/* Footer — Save button (hidden for viewer, not disabled) */}
      {!isViewer && (
        <div className="flex flex-col items-end gap-2">
          {serverError && (
            <p className="text-sm text-destructive" role="alert">
              {serverError}
            </p>
          )}
          {successMessage && (
            <p className="text-sm text-[#16A34A]" role="status">
              Configurações salvas com sucesso.
            </p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="min-w-[160px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar configurações'
            )}
          </Button>
        </div>
      )}
    </form>
  )
}
