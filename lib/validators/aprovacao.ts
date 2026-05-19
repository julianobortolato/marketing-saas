import { z } from 'zod'

export const batchDecisionSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, 'Selecione de 1 a 10 itens.')
    .max(10)
    .refine((a) => a.length <= 10, 'Selecione de 1 a 10 itens.'),
  decision: z.enum(['aprovado', 'rejeitado']),
})

export type BatchDecisionInput = z.infer<typeof batchDecisionSchema>
