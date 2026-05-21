/**
 * Zod schemas for the 5 CMO agent tool inputs (ADR-MKT-001 §7).
 * Use .safeParse() in service code — never .parse().
 */
import { z } from 'zod'

export const consultarDisponibilidadeSchema = z.object({
  /** Data no formato YYYY-MM-DD */
  data_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  /** Horário preferido — ex: "10:00" */
  horario_preferido: z.string().optional(),
})

export const agendarAulaExperimentalSchema = z.object({
  /** UUID do lead a ser agendado */
  lead_id: z.string().uuid('lead_id deve ser um UUID válido'),
  /** Data do agendamento: YYYY-MM-DD */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  /** Horário: HH:mm */
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  /** Modalidade: musculação, funcional, pilates, etc */
  modalidade: z.string().min(1),
  /** Observação adicional (opcional) */
  observacao: z.string().optional(),
})

export const salvarPerfilLeadSchema = z.object({
  /** UUID do lead */
  lead_id: z.string().uuid('lead_id deve ser um UUID válido'),
  nome: z.string().optional(),
  objetivo: z.string().optional(),
  interesse_principal: z.string().optional(),
  nivel_urgencia: z.enum(['baixa', 'media', 'alta']).nullable().optional(),
})

export const scoreLeadSchema = z.object({
  /** UUID do lead */
  lead_id: z.string().uuid('lead_id deve ser um UUID válido'),
  sinais: z.object({
    /** Intensidade da conversa (1–5) */
    engajamento: z.number().int().min(1).max(5),
    /** Sinais de "quero agendar" (1–5) */
    proximidade_decisao: z.number().int().min(1).max(5),
    /** Bate com persona-alvo da academia (1–5) */
    compatibilidade_perfil: z.number().int().min(1).max(5),
  }),
})

export const handoffHumanoSchema = z.object({
  /** UUID da conversa */
  conversa_id: z.string().uuid('conversa_id deve ser um UUID válido'),
  motivo: z.enum(['desconto', 'reclamacao', 'duvida_complexa', 'pedido_explicito', 'outro']),
  observacao_para_atendente: z.string().min(1),
})

export type ConsultarDisponibilidadeInput = z.infer<typeof consultarDisponibilidadeSchema>
export type AgendarAulaExperimentalInput = z.infer<typeof agendarAulaExperimentalSchema>
export type SalvarPerfilLeadInput = z.infer<typeof salvarPerfilLeadSchema>
export type ScoreLeadInput = z.infer<typeof scoreLeadSchema>
export type HandoffHumanoInput = z.infer<typeof handoffHumanoSchema>
