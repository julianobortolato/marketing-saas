import { z } from 'zod'

export const editorialConfigSchema = z.object({
  caderno_editorial_escopo: z.string().max(5000).optional(),
  caderno_editorial_tom: z.string().max(500).optional(),
  caderno_editorial_restricoes: z.string().max(2000).optional(),
  caderno_editorial_objetivos: z
    .array(z.string().min(1).max(200))
    .max(20)
    .optional(),
  caderno_editorial_exemplos: z.string().max(5000).optional(),
  palavras_proibidas: z.array(z.string().min(1).max(50)).max(50).optional(),
  persona_cmo: z.string().max(500).optional(),
  gatilhos_handoff: z.record(z.string(), z.boolean()).optional(),
})

export type EditorialConfigInput = z.infer<typeof editorialConfigSchema>
