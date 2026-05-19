'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { leadCreateSchema, type LeadCreateFormValues } from '@/lib/validators/lead'
import { createLead } from './actions'

export function NewLeadDialog() {
  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadCreateFormValues>({
    resolver: zodResolver(leadCreateSchema),
    defaultValues: { origem: 'manual' },
  })

  async function onSubmit(data: LeadCreateFormValues) {
    setServerError(null)
    const result = await createLead(data as unknown)
    if (result && 'error' in result) {
      const msg = typeof result.error === 'string' ? result.error : 'Erro ao salvar.'
      setServerError(msg)
      return
    }
    setSuccess(true)
    reset()
    setTimeout(() => {
      setSuccess(false)
      setOpen(false)
    }, 2000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[36px] items-center rounded-lg bg-[#E30613] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C0040F]"
      >
        Novo lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-bold text-[#0F172A]">Novo lead</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lead-nome">Nome</Label>
                <Input
                  id="lead-nome"
                  type="text"
                  placeholder="Nome do lead"
                  aria-invalid={!!errors.nome}
                  {...register('nome')}
                />
                {errors.nome && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.nome.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-telefone">Telefone</Label>
                <Input
                  id="lead-telefone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  aria-invalid={!!errors.telefone}
                  {...register('telefone')}
                />
                {errors.telefone && (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.telefone.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lead-origem">Canal</Label>
                <select
                  id="lead-origem"
                  {...register('origem')}
                  className="w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613]"
                >
                  <option value="manual">Manual</option>
                  <option value="meta_form">Meta Form</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="google">Google</option>
                </select>
              </div>

              {serverError && (
                <p className="text-sm text-red-600" role="alert">
                  {serverError}
                </p>
              )}
              {success && (
                <p className="text-sm text-[#16A34A]" role="status">
                  Lead cadastrado com sucesso.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); reset(); setServerError(null) }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#E30613] hover:bg-[#C0040F] text-white"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
