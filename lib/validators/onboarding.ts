import { z } from 'zod'

export const passo1Schema = z.object({
  nome_dono:    z.string().min(2, 'Nome obrigatório'),
  nome_empresa: z.string().min(2, 'Nome da empresa obrigatório'),
  cidade:       z.string().min(2, 'Cidade obrigatória'),
  whatsapp:     z
    .string()
    .min(10, 'WhatsApp inválido')
    .regex(/^\+?[1-9]\d{7,14}$/, 'Informe o número com DDD (ex: 67912345678)'),
})
export type Passo1Input = z.infer<typeof passo1Schema>

export const passo2Schema = z.object({
  vertical: z.enum(['fitness', 'gastronomia', 'beleza', 'generico']),
})
export type Passo2Input = z.infer<typeof passo2Schema>

export const passo3ConfirmSchema = z.object({
  cor_primaria:   z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  cor_secundaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').optional(),
  fonte_titulo:   z.string().min(1),
  fonte_corpo:    z.string().min(1).default('Inter'),
  logo_url:       z.string().url().nullable(),
  palette:        z.array(z.string()).max(8),
})
export type Passo3ConfirmInput = z.infer<typeof passo3ConfirmSchema>

export const passo4Schema = z.object({
  tom:                z.enum(['formal', 'neutro', 'coloquial']),
  publico_descricao:  z.string().min(10, 'Descreva seu público (mín. 10 caracteres)'),
  diferencial:        z.string().min(10, 'Descreva o diferencial (mín. 10 caracteres)'),
  temas:              z.array(z.string()).min(1, 'Selecione ao menos 1 tema'),
  frequencia:         z.enum(['diaria', '3x_semana', 'semanal', 'quinzenal']),
  palavras_preferidas: z.array(z.string()),
  palavras_a_evitar:  z.array(z.string()),
})
export type Passo4Input = z.infer<typeof passo4Schema>
