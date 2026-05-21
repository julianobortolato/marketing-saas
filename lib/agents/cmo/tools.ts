/**
 * CMO agent tool definitions and dispatcher (ADR-MKT-001 §7).
 *
 * Exports:
 *   cmoTools — OpenAI ChatCompletionTool[] array for the tools parameter
 *   dispatchTool — routes tool calls to handlers, validates args, never throws
 */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ToolCallResult } from '@/lib/openai/types'
import {
  consultarDisponibilidadeSchema,
  agendarAulaExperimentalSchema,
  salvarPerfilLeadSchema,
  scoreLeadSchema,
  handoffHumanoSchema,
} from '@/lib/validators/cmo-tools'

export interface ToolContext {
  supabase: ReturnType<typeof createAdminClient>
  tenantId: string
  conversaId: string
  leadId: string
}

// ============================================================
// OpenAI tool definitions (function calling schemas)
// ============================================================

export const cmoTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidade_ae',
      description:
        'Verifica os horários disponíveis para Aula Experimental em uma data específica. Use antes de agendar para garantir disponibilidade.',
      parameters: {
        type: 'object',
        properties: {
          data_iso: {
            type: 'string',
            description: 'Data no formato YYYY-MM-DD (ex: 2026-06-15)',
          },
          horario_preferido: {
            type: 'string',
            description: 'Horário preferido no formato HH:mm (ex: 09:00) — opcional',
          },
        },
        required: ['data_iso'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_aula_experimental',
      description:
        'Agenda uma Aula Experimental para o lead. Chame consultar_disponibilidade_ae primeiro para garantir disponibilidade.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead a ser agendado',
          },
          data: {
            type: 'string',
            description: 'Data do agendamento no formato YYYY-MM-DD',
          },
          horario: {
            type: 'string',
            description: 'Horário do agendamento no formato HH:mm',
          },
          modalidade: {
            type: 'string',
            description: 'Modalidade desejada: musculacao, funcional, pilates, etc',
          },
          observacao: {
            type: 'string',
            description: 'Observação adicional sobre o agendamento (opcional)',
          },
        },
        required: ['lead_id', 'data', 'horario', 'modalidade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvar_perfil_lead',
      description:
        'Salva informações do perfil do lead conforme surgem na conversa (nome, objetivo, interesse, urgência). Use para enriquecer o perfil progressivamente.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead',
          },
          nome: {
            type: 'string',
            description: 'Nome do lead (opcional)',
          },
          objetivo: {
            type: 'string',
            description: 'Objetivo principal: emagrecer, ganhar_massa, saude, condicionamento (opcional)',
          },
          interesse_principal: {
            type: 'string',
            description: 'Modalidade ou serviço de maior interesse (opcional)',
          },
          nivel_urgencia: {
            type: 'string',
            enum: ['baixa', 'media', 'alta'],
            description: 'Urgência percebida de tomada de decisão (opcional)',
          },
        },
        required: ['lead_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'score_lead',
      description:
        'Calcula e registra o score de qualificação do lead com base em sinais explícitos da conversa (engajamento, proximidade de decisão, compatibilidade).',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'UUID do lead',
          },
          sinais: {
            type: 'object',
            properties: {
              engajamento: {
                type: 'integer',
                minimum: 1,
                maximum: 5,
                description: 'Intensidade da conversa: 1=mínimo, 5=máximo',
              },
              proximidade_decisao: {
                type: 'integer',
                minimum: 1,
                maximum: 5,
                description: 'Sinais de intenção de agendar: 1=nenhum, 5=quer agendar agora',
              },
              compatibilidade_perfil: {
                type: 'integer',
                minimum: 1,
                maximum: 5,
                description: 'Alinhamento com a persona-alvo da academia: 1=baixo, 5=alto',
              },
            },
            required: ['engajamento', 'proximidade_decisao', 'compatibilidade_perfil'],
          },
        },
        required: ['lead_id', 'sinais'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handoff_humano',
      description:
        'Transfere a conversa para um atendente humano. Use quando o lead pede desconto, tem reclamação, dúvida complexa, ou solicita explicitamente falar com humano. Irrevogável até ação humana no dashboard.',
      parameters: {
        type: 'object',
        properties: {
          conversa_id: {
            type: 'string',
            description: 'UUID da conversa atual',
          },
          motivo: {
            type: 'string',
            enum: ['desconto', 'reclamacao', 'duvida_complexa', 'pedido_explicito', 'outro'],
            description: 'Motivo do handoff para o atendente',
          },
          observacao_para_atendente: {
            type: 'string',
            description: 'Contexto para o atendente humano — resumo da situação',
          },
        },
        required: ['conversa_id', 'motivo', 'observacao_para_atendente'],
      },
    },
  },
]

// ============================================================
// Individual tool handlers
// ============================================================

async function handleConsultarDisponibilidade(
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  const parsed = consultarDisponibilidadeSchema.safeParse(args)
  if (!parsed.success) return { erro: 'validation_failed' }

  // Pure read from academia_config.horarios for the given day
  // Returns available slots based on the schedule stored per tenant
  const { data, error } = await context.supabase
    .from('academia_config')
    .select('horarios')
    .eq('tenant_id', context.tenantId) // defense-in-depth on top of RLS
    .single()

  if (error || !data) {
    return { resultado: { horarios_disponiveis: [] } }
  }

  // Parse horarios blob — it's a flexible JSON structure
  const horarios = data.horarios as { text?: string } | null
  const horarioText = horarios?.text ?? ''

  // Simple heuristic: if there's a schedule text, return generic available slots
  // The full slot-management system is future work; v1 returns the text info
  const slots = horarioText ? ['07:00', '09:00', '10:00', '15:00', '17:00', '19:00'] : []

  return {
    resultado: {
      horarios_disponiveis: slots,
      horarios_texto: horarioText,
      data: parsed.data.data_iso,
    },
  }
}

async function handleAgendarAulaExperimental(
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  const parsed = agendarAulaExperimentalSchema.safeParse(args)
  if (!parsed.success) return { erro: 'validation_failed' }

  const { lead_id, data, horario, modalidade, observacao } = parsed.data

  // ADR §7 — no rpc_agendar_aula_experimental in migration 0010;
  // use supabase.from('leads').update({ status: 'agendado' }) with defense-in-depth tenant filter
  const { error } = await context.supabase
    .from('leads')
    .update({
      status: 'agendado',
    })
    .eq('tenant_id', context.tenantId) // defense-in-depth — cross-tenant LLM hallucination prevention
    .eq('id', lead_id)

  if (error) {
    return { erro: `agendar_failed: ${error.message}` }
  }

  const mensagem_confirmacao = `Aula Experimental agendada para ${data} às ${horario}${modalidade ? ` — ${modalidade}` : ''}${observacao ? `. Observação: ${observacao}` : ''}.`

  return {
    resultado: {
      ok: true,
      agendamento_id: lead_id, // v1: use lead_id as reference; dedicated agenda table in future
      mensagem_confirmacao,
    },
  }
}

async function handleSalvarPerfilLead(
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  const parsed = salvarPerfilLeadSchema.safeParse(args)
  if (!parsed.success) return { erro: 'validation_failed' }

  const { lead_id, nome, objetivo, interesse_principal, nivel_urgencia } = parsed.data

  const updates: Record<string, unknown> = {}
  if (nome !== undefined) updates.nome = nome
  if (objetivo !== undefined) updates.objetivo = objetivo
  if (interesse_principal !== undefined) updates.interesse_principal = interesse_principal
  if (nivel_urgencia !== undefined) updates.nivel_urgencia = nivel_urgencia

  if (Object.keys(updates).length === 0) {
    return { resultado: { ok: true } }
  }

  const { error } = await context.supabase
    .from('leads')
    .update(updates)
    .eq('tenant_id', context.tenantId) // defense-in-depth on top of RLS
    .eq('id', lead_id)

  if (error) {
    return { erro: `salvar_perfil_failed: ${error.message}` }
  }

  return { resultado: { ok: true } }
}

async function handleScoreLead(
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  const parsed = scoreLeadSchema.safeParse(args)
  if (!parsed.success) return { erro: 'validation_failed' }

  const { lead_id, sinais } = parsed.data
  const { engajamento, proximidade_decisao, compatibilidade_perfil } = sinais

  // Deterministic formula: round((eng + prox + compat) * 10 / 15), clamped 1..10
  const rawScore = Math.round((engajamento + proximidade_decisao + compatibilidade_perfil) * 10 / 15)
  const score = Math.max(1, Math.min(10, rawScore))

  const faixa: 'frio' | 'morno' | 'quente' =
    score <= 4 ? 'frio' : score <= 7 ? 'morno' : 'quente'

  // Call rpc_atualizar_score_lead with explicit p_tenant_id
  const { data, error } = await context.supabase.rpc('rpc_atualizar_score_lead', {
    p_tenant_id: context.tenantId,
    p_lead_id: lead_id,
    p_score: score,
    p_motivo: `sinais: eng=${engajamento} prox=${proximidade_decisao} compat=${compatibilidade_perfil}`,
  })

  if (error) {
    return { erro: `score_failed: ${error.message}` }
  }

  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    return { erro: 'lead_not_found_or_wrong_tenant' }
  }

  return { resultado: { score, faixa } }
}

async function handleHandoffHumano(
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  const parsed = handoffHumanoSchema.safeParse(args)
  if (!parsed.success) return { erro: 'validation_failed' }

  const { conversa_id, motivo } = parsed.data

  // Call rpc_handoff_humano with explicit p_tenant_id
  const { data, error } = await context.supabase.rpc('rpc_handoff_humano', {
    p_tenant_id: context.tenantId,
    p_conversa_id: conversa_id,
    p_motivo: motivo,
  })

  if (error) {
    return { erro: `handoff_failed: ${error.message}` }
  }

  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    return { erro: 'conversa_not_found_or_wrong_tenant' }
  }

  return { resultado: { ok: true } }
}

// ============================================================
// Dispatcher
// ============================================================

/**
 * Routes a tool call by name to its handler.
 * Validates args via Zod .safeParse().
 * Never throws — returns { erro } on validation failure or RPC error.
 */
export async function dispatchTool(
  name: string,
  args: unknown,
  context: ToolContext,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'consultar_disponibilidade_ae':
        return await handleConsultarDisponibilidade(args, context)
      case 'agendar_aula_experimental':
        return await handleAgendarAulaExperimental(args, context)
      case 'salvar_perfil_lead':
        return await handleSalvarPerfilLead(args, context)
      case 'score_lead':
        return await handleScoreLead(args, context)
      case 'handoff_humano':
        return await handleHandoffHumano(args, context)
      default:
        return { erro: `unknown_tool: ${name}` }
    }
  } catch (err) {
    return { erro: err instanceof Error ? err.message : 'tool_dispatch_failed' }
  }
}
