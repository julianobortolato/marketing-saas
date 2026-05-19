import { z } from 'zod'

export const leadCreateSchema = z.object({
  nome: z.string().min(1, 'Campo obrigatório.'),
  telefone: z
    .string()
    .min(1, 'Campo obrigatório.')
    .transform((v) => v.replace(/[^\d]/g, ''))
    .refine((v) => v.length >= 8, 'Telefone inválido.'),
  origem: z
    .enum(['meta_form', 'whatsapp', 'google', 'manual'])
    .default('manual'),
})

export const leadStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['novo', 'contatado', 'agendado', 'convertido', 'perdido']),
})

// Output type (after defaults + transform applied)
export type LeadCreateInput = z.infer<typeof leadCreateSchema>
// Input type (before transform — what react-hook-form sends)
export type LeadCreateFormValues = z.input<typeof leadCreateSchema>
export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>
