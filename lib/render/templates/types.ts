import { z } from 'zod'
import { FONTS_DISPONIVEIS } from '../fonts'

export const SlotsSchema = z.object({
  foto_url:       z.string().url(),
  copy_principal: z.string().min(1).max(120),
  cta:            z.string().min(1).max(40),
  logo_url:       z.string().url(),
  cor_primaria:   z.string().min(1),
  cor_secundaria: z.string().optional(),
  fonte_familia:  z.enum(FONTS_DISPONIVEIS).optional(),
  nome_tenant:    z.string().max(80).optional(),
  hashtags:       z.array(z.string().max(30)).max(5).optional(),
})

export type TemplateSlots = z.infer<typeof SlotsSchema>

export type FormatoTemplate = 'feed' | 'story' | 'carousel_slide'
