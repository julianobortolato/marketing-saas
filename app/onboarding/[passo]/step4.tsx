'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { passo4Schema, type Passo4Input } from '@/lib/validators/onboarding'
import { savePasso4 } from './actions'
import type { BrandManual } from '@/lib/queries/brand-manual'

const TEMAS_OPTIONS = ['treino','bastidores','equipe','depoimento','produto','promoção','motivação','dicas','resultados','evento']
const FREQ_OPTIONS = [
  { value: 'diaria', label: 'Diária' },
  { value: '3x_semana', label: '3× por semana' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
]

export function Step4({ brandManual }: { brandManual: BrandManual }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pfInput, setPfInput] = useState('')
  const [paInput, setPaInput] = useState('')

  const { handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<Passo4Input>({
    resolver: zodResolver(passo4Schema),
    defaultValues: {
      tom: (['formal', 'neutro', 'coloquial'].includes(brandManual.tom_de_voz?.tom ?? '') ? brandManual.tom_de_voz!.tom as Passo4Input['tom'] : 'neutro'),
      publico_descricao: brandManual.publico_alvo?.descricao ?? '',
      diferencial: brandManual.publico_alvo?.diferencial ?? '',
      temas: brandManual.tom_de_voz?.temas_recorrentes ?? [],
      frequencia: (['diaria', '3x_semana', 'semanal', 'quinzenal'].includes(brandManual.tom_de_voz?.frequencia ?? '') ? brandManual.tom_de_voz!.frequencia as Passo4Input['frequencia'] : '3x_semana'),
      palavras_preferidas: brandManual.tom_de_voz?.palavras_preferidas ?? [],
      palavras_a_evitar: brandManual.tom_de_voz?.palavras_a_evitar ?? [],
    },
  })

  const tom = watch('tom')
  const temas = watch('temas')
  const frequencia = watch('frequencia')
  const prefList = watch('palavras_preferidas')
  const evitarList = watch('palavras_a_evitar')

  function toggleTema(t: string) {
    setValue('temas', temas.includes(t) ? temas.filter(x => x !== t) : [...temas, t], { shouldValidate: true, shouldDirty: true })
  }

  function addTag(list: string[], val: string, field: 'palavras_preferidas' | 'palavras_a_evitar') {
    const trimmed = val.trim()
    if (trimmed && !list.includes(trimmed)) setValue(field, [...list, trimmed], { shouldValidate: true, shouldDirty: true })
  }

  async function onSubmit(data: Passo4Input) {
    setServerError(null)
    const result = await savePasso4(data)
    if (result.error) { setServerError(result.error); return }
    router.push('/onboarding/5')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Identidade da marca</h1>
        <p className="mt-1 text-sm text-[#64748B]">A IA usa estas respostas para criar conteúdo no seu tom.</p>
      </div>

      {/* Tom */}
      <div className="space-y-2">
        <Label>Tom de voz</Label>
        <div className="flex gap-2">
          {(['formal','neutro','coloquial'] as const).map(t => (
            <button type="button" key={t}
              onClick={() => setValue('tom', t, { shouldValidate: true, shouldDirty: true })}
              className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium capitalize transition ${tom === t ? 'border-[#1A2E4A] bg-[#1A2E4A] text-white' : 'border-[#E2E8F0] text-[#1A2E4A] hover:border-[#1A2E4A]/40'}`}>
              {t}
            </button>
          ))}
        </div>
        {errors.tom && <p className="text-sm text-red-500">{errors.tom.message}</p>}
      </div>

      {/* Público */}
      <div className="space-y-1.5">
        <Label htmlFor="publico">Público-alvo</Label>
        <Controller
          control={control}
          name="publico_descricao"
          render={({ field }) => (
            <Textarea id="publico" rows={2} placeholder="Ex: Mulheres 25-40 que buscam emagrecimento e qualidade de vida" {...field} />
          )}
        />
        {errors.publico_descricao && <p className="text-sm text-red-500">{errors.publico_descricao.message}</p>}
      </div>

      {/* Diferencial */}
      <div className="space-y-1.5">
        <Label htmlFor="diferencial">Diferencial da empresa</Label>
        <Controller
          control={control}
          name="diferencial"
          render={({ field }) => (
            <Textarea id="diferencial" rows={2} placeholder="Ex: Único estúdio de pilates com avaliação postural grátis na cidade" {...field} />
          )}
        />
        {errors.diferencial && <p className="text-sm text-red-500">{errors.diferencial.message}</p>}
      </div>

      {/* Temas */}
      <div className="space-y-2">
        <Label>Temas preferidos <span className="text-[#64748B]">(selecione ao menos 1)</span></Label>
        <div className="flex flex-wrap gap-2">
          {TEMAS_OPTIONS.map(t => (
            <button type="button" key={t} onClick={() => toggleTema(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${temas.includes(t) ? 'border-[#1A2E4A] bg-[#1A2E4A] text-white' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#1A2E4A]/40'}`}>
              {t}
            </button>
          ))}
        </div>
        {errors.temas && <p className="text-sm text-red-500">{errors.temas.message}</p>}
      </div>

      {/* Frequência */}
      <div className="space-y-2">
        <Label>Frequência de posts</Label>
        <div className="flex flex-wrap gap-2">
          {FREQ_OPTIONS.map(f => (
            <button type="button" key={f.value}
              onClick={() => setValue('frequencia', f.value as Passo4Input['frequencia'], { shouldValidate: true, shouldDirty: true })}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition ${frequencia === f.value ? 'border-[#1A2E4A] bg-[#1A2E4A] text-white' : 'border-[#E2E8F0] text-[#1A2E4A] hover:border-[#1A2E4A]/40'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {errors.frequencia && <p className="text-sm text-red-500">{errors.frequencia.message}</p>}
      </div>

      {/* Palavras preferidas */}
      <div className="space-y-2">
        <Label>Palavras que você QUER usar <span className="text-[#64748B]">(opcional)</span></Label>
        <div className="flex gap-2">
          <input value={pfInput} onChange={e => setPfInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(prefList, pfInput, 'palavras_preferidas'); setPfInput('') }}}
            placeholder="Ex: Você consegue! — Enter para adicionar" className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#1A2E4A]" />
        </div>
        <div className="flex flex-wrap gap-1">{prefList.map(w => <span key={w} onClick={() => setValue('palavras_preferidas', prefList.filter(x => x !== w), { shouldValidate: true, shouldDirty: true })} className="cursor-pointer rounded-full bg-[#1A2E4A]/10 px-2 py-0.5 text-xs text-[#1A2E4A]">{w} ×</span>)}</div>
      </div>

      {/* Palavras a evitar */}
      <div className="space-y-2">
        <Label>Palavras a EVITAR <span className="text-[#64748B]">(opcional)</span></Label>
        <div className="flex gap-2">
          <input value={paInput} onChange={e => setPaInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(evitarList, paInput, 'palavras_a_evitar'); setPaInput('') }}}
            placeholder="Enter para adicionar" className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#1A2E4A]" />
        </div>
        <div className="flex flex-wrap gap-1">{evitarList.map(w => <span key={w} onClick={() => setValue('palavras_a_evitar', evitarList.filter(x => x !== w), { shouldValidate: true, shouldDirty: true })} className="cursor-pointer rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">{w} ×</span>)}</div>
      </div>

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/onboarding/3')} className="flex-1">← Voltar</Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1 bg-[#1A2E4A] text-white hover:bg-[#243d60]">
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Analisar com IA →'}
        </Button>
      </div>
    </form>
  )
}
