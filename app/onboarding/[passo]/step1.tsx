'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passo1Schema, type Passo1Input } from '@/lib/validators/onboarding'
import { savePasso1 } from './actions'
import type { TenantRow } from '@/lib/queries/tenant'

export function Step1({ tenant }: { tenant: TenantRow }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Passo1Input>({
    resolver: zodResolver(passo1Schema),
    defaultValues: {
      nome_empresa: tenant.nome,
      cidade: tenant.cidade ?? '',
      whatsapp: tenant.whatsapp_owner ?? '',
    },
  })

  async function onSubmit(data: Passo1Input) {
    setServerError(null)
    const result = await savePasso1(data)
    if (result.error) { setServerError(result.error); return }
    router.push('/onboarding/2')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Vamos começar!</h1>
        <p className="mt-1 text-sm text-[#64748B]">Leva menos de 30 segundos.</p>
      </div>

      {[
        { id: 'nome_dono',    label: 'Seu nome',              placeholder: 'João Silva' },
        { id: 'nome_empresa', label: 'Nome da empresa',       placeholder: 'Academia Fit Pro' },
        { id: 'cidade',       label: 'Cidade',                placeholder: 'Campo Grande, MS' },
        { id: 'whatsapp',     label: 'Seu WhatsApp (com DDD)', placeholder: '67912345678' },
      ].map(({ id, label, placeholder }) => (
        <div key={id} className="space-y-1.5">
          <Label htmlFor={id}>{label}</Label>
          <Input id={id} placeholder={placeholder} {...register(id as keyof Passo1Input)} />
          {errors[id as keyof Passo1Input] && (
            <p className="text-sm text-red-500">{errors[id as keyof Passo1Input]?.message}</p>
          )}
        </div>
      ))}

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] bg-[#1A2E4A] hover:bg-[#243d60] text-white">
        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Continuar →'}
      </Button>
    </form>
  )
}
