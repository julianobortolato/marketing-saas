/**
 * Post-LLM deterministic guardrails (ADR-MKT-001 §9).
 *
 * applyGuardrails runs 7 checks in order — once handoff is triggered, no further
 * checks run (handoff short-circuits). Never throws.
 *
 * Guard order (per ADR §9):
 *  1. Loop tool-use  — toolUseIterations >= 5
 *  2. Resposta vazia — texto.trim() === ''
 *  3. Resposta muito longa — > 1200 chars
 *  4. Desconto       — regex match on LLM response text
 *  5. Preço          — R$ value not in planos JSON (conservative v1)
 *  6. Palavras proibidas — match in context.palavrasProibidas
 *  7. Identidade     — LLM mentioned nomes próprios not the lead's
 */

/** Fallback message exported for callers that need the constant. */
export const FALLBACK_DESCONTO =
  'Entendo que está buscando a melhor condição. Vou conectar você a um especialista que poderá ajudar com isso.'

const DESCONTO_REGEX = /\b(desconto|cupom|promo[çc][aã]o|mais barato)\b/i

/**
 * Context passed to applyGuardrails.
 *
 * - palavrasProibidas: list from academia_config.palavras_proibidas (TEXT[])
 * - nomesProprios: list of staff/brand names the LLM should not mention
 * - horarios: academia_config.horarios (JSON blob)
 * - planos: academia_config.planos (JSON blob) — used by Preço guardrail
 * - toolUseIterations: current iteration count in the tool-use loop
 */
export interface GuardrailContext {
  palavrasProibidas: string[]
  nomesProprios?: string[]
  horarios?: unknown
  planos?: unknown
  toolUseIterations: number
}

export interface GuardrailResult {
  texto: string
  handoff_solicitado: boolean
  motivo?: string
}

/**
 * Applies 7 deterministic guardrails to the LLM response text.
 * Pure function — never throws.
 */
export function applyGuardrails(
  texto: string,
  context: GuardrailContext,
): GuardrailResult {
  // Guard 1: Loop tool-use — checked first to catch runaway loops immediately
  if (context.toolUseIterations >= 5) {
    return {
      texto: 'Um momento, vou verificar isso com a equipe',
      handoff_solicitado: true,
      motivo: 'loop_tool_use',
    }
  }

  const trimmed = texto.trim()

  // Guard 2: Resposta vazia
  if (trimmed === '') {
    return {
      texto: 'Um momento, vou verificar isso com a equipe',
      handoff_solicitado: true,
      motivo: 'resposta_vazia',
    }
  }

  // Guard 3: Resposta muito longa (>1200 chars) — caller may retry once
  if (trimmed.length > 1200) {
    return {
      texto: trimmed,
      handoff_solicitado: true,
      motivo: 'resposta_muito_longa',
    }
  }

  // Guard 4: Desconto — regex match forces handoff regardless of phrasing
  if (DESCONTO_REGEX.test(trimmed)) {
    return {
      texto: FALLBACK_DESCONTO,
      handoff_solicitado: true,
      motivo: 'desconto_detectado',
    }
  }

  // Guard 5: Preço — conservative v1 proxy
  // Any R$ value in the LLM response that does NOT literally appear in planos JSON → handoff.
  // TODO: implement fuzzy >5% comparison per ADR §9 (current: literal string check, always safer)
  if (trimmed.includes('R$') || trimmed.includes('R $')) {
    const planosText = context.planos ? JSON.stringify(context.planos) : ''
    // Extract all R$ values from the LLM response
    const reaisMatches = trimmed.match(/R\$\s*[\d.,]+/g) ?? []
    for (const match of reaisMatches) {
      const normalized = match.replace(/\s/g, '')
      if (!planosText.includes(normalized)) {
        return {
          texto: 'Vou confirmar esse valor com a equipe para garantir a informação mais atualizada.',
          handoff_solicitado: true,
          motivo: 'preco_divergente',
        }
      }
    }
  }

  // Guard 6: Palavras proibidas — build regex from context list, force handoff
  if (context.palavrasProibidas.length > 0) {
    const escaped = context.palavrasProibidas.map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    const proibidoRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'i')
    if (proibidoRegex.test(trimmed)) {
      return {
        texto: 'Um momento, vou verificar como posso ajudar melhor.',
        handoff_solicitado: true,
        motivo: 'palavra_proibida',
      }
    }
  }

  // Guard 7: Identidade — LLM should not mention staff names not belonging to the lead
  if (context.nomesProprios && context.nomesProprios.length > 0) {
    const escapedNames = context.nomesProprios.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    const nomesRegex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'i')
    if (nomesRegex.test(trimmed)) {
      return {
        texto: trimmed.replace(
          nomesRegex,
          'a equipe',
        ),
        handoff_solicitado: false,
        motivo: undefined,
      }
    }
  }

  return {
    texto: trimmed,
    handoff_solicitado: false,
  }
}
