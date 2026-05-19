import { z } from 'zod'

export const academiaConfigSchema = z.object({
  nome_academia: z.string().min(1, 'Campo obrigatório.'),
  bairro: z.string().min(1, 'Campo obrigatório.'),
  cidade: z.string().min(1, 'Campo obrigatório.'),
  raio_km: z.coerce.number().min(1).max(50).default(5),
  tom_de_voz: z.enum(['formal', 'neutro', 'coloquial']).default('neutro'),
  diferenciais: z.array(z.string()).max(10).default([]),
  horarios: z.string().optional(),
  planos: z.string().optional(),
})

// Output type (after defaults applied) — used in Server Actions and typed results
export type AcademiaConfigInput = z.infer<typeof academiaConfigSchema>

// Input type (before defaults — matches what react-hook-form sends)
export type AcademiaConfigFormValues = z.input<typeof academiaConfigSchema>
