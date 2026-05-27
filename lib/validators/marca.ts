import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (ex: #1A2E4A)')

export const FONTES_CURADAS = [
  'Plus Jakarta Sans',
  'Inter',
  'Syne',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Poppins',
] as const

export const marcaVisualSchema = z.object({
  cor_primaria: hexColor,
  cor_secundaria: hexColor,
  fonte_titulo: z.string().min(1, 'Selecione uma fonte'),
  fonte_corpo: z.string().min(1, 'Selecione uma fonte'),
})

export const marcaTomDeVozSchema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(500),
  tom: z.string().min(1, 'Obrigatório'),
  temas_recorrentes: z.array(z.string()).min(1, 'Adicione ao menos 1 tema'),
  frequencia: z.string().min(1, 'Obrigatório'),
  palavras_preferidas: z.array(z.string()),
  palavras_a_evitar: z.array(z.string()),
})

export const marcaPublicoAlvoSchema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(500),
  diferencial: z.string().min(1, 'Obrigatório').max(500),
})

export const marcaFormSchema = z.object({
  visual: marcaVisualSchema,
  tom_de_voz: marcaTomDeVozSchema,
  publico_alvo: marcaPublicoAlvoSchema,
})

export type MarcaFormValues = z.infer<typeof marcaFormSchema>
export type MarcaVisualInput = z.infer<typeof marcaVisualSchema>
export type MarcaTomDeVozInput = z.infer<typeof marcaTomDeVozSchema>
export type MarcaPublicoAlvoInput = z.infer<typeof marcaPublicoAlvoSchema>
