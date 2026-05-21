/**
 * Dynamic 5-block system prompt assembly (ADR-MKT-001 §8.1).
 *
 * Blocks 1–4 are stable per tenant — eligible for OpenAI prompt caching.
 * Block 5 contains the last 20 messages — variable, not cached.
 *
 * CLAUDE.md identity rule: NO hardcoded tenant strings anywhere in this file.
 * Every dynamic value MUST come from academiaConfig or chatHistory params.
 */

/** Minimal shape of academia_config columns needed for prompt assembly. */
export interface AcademiaConfigForPrompt {
  tenant_id: string
  nome_academia: string
  bairro?: string | null
  cidade?: string | null
  tom_de_voz?: string | null
  diferenciais?: string[] | null
  horarios?: { text?: string } | null
  planos?: { text?: string } | null
  caderno_editorial_escopo?: string | null
  caderno_editorial_tom?: string | null
  caderno_editorial_restricoes?: string | null
  caderno_editorial_objetivos?: string[] | null
  caderno_editorial_exemplos?: string | null
  argumentos_venda?: Array<{ contexto?: string; argumento?: string; evidencia?: string }> | null
  objecoes_comuns?: Array<{ objecao?: string; resposta_padrao?: string }> | null
  palavras_proibidas?: string[] | null
  gatilhos_handoff?: Record<string, unknown> | null
  persona_cmo?: string | null
  // Other fields from AcademiaConfigRow that may be present
  [key: string]: unknown
}

/** Minimal shape of a chat message needed for prompt assembly. */
export interface ChatMessage {
  id: string
  tenant_id: string
  conversa_id: string
  evolution_message_id: string | null
  direcao: 'entrada' | 'saida'
  tipo: 'texto' | 'audio' | 'imagem' | 'outro'
  conteudo: string
  enviada_em: string
  status_envio: string | null
}

/**
 * Pure function — never throws.
 * Assembles the 5-block system prompt from academia_config and the last 20 chat messages.
 * No hardcoded tenant strings — all dynamic values come from params.
 */
export function buildSystemPrompt(params: {
  academiaConfig: AcademiaConfigForPrompt
  chatHistory: ChatMessage[]
}): string {
  const { academiaConfig: c, chatHistory } = params

  // ── BLOCO 1 — Persona CMO ────────────────────────────────────────────────────
  // Stable per tenant — prompt-cache eligible (no dynamic values except optional override)
  const personaOverride = c.persona_cmo?.trim()
    ? `\n\nPersonalidade customizada: ${c.persona_cmo.trim()}`
    : ''

  const bloco1 = `[BLOCO 1 — Persona CMO]
Você é o CMO autônomo da ${c.nome_academia}. Sua função é conversar com leads via WhatsApp, entender o que buscam, e agendar uma Aula Experimental sempre que houver fit. Você não vende — você consulta, entende e propõe.

Seja sempre consultivo, empático e objetivo. Nunca pressione. Nunca conceda desconto — se o lead pedir, chame a tool handoff_humano imediatamente.${personaOverride}`

  // ── BLOCO 2 — DNA da academia ─────────────────────────────────────────────────
  // Stable per tenant — prompt-cache eligible
  const diferenciais = c.diferenciais?.length
    ? c.diferenciais.join(', ')
    : 'não informados'
  const horarios = c.horarios?.text ?? 'consultar disponibilidade via tool'
  const planos = c.planos?.text ?? 'consultar planos com a equipe'
  const tom = c.tom_de_voz ?? 'consultivo'
  const bairro = c.bairro ?? ''
  const cidade = c.cidade ?? ''
  const localizacao = [bairro, cidade].filter(Boolean).join(', ') || 'localização não informada'

  const bloco2 = `[BLOCO 2 — DNA da academia]
Academia: ${c.nome_academia}
Localização: ${localizacao}
Tom de voz: ${tom}
Diferenciais: ${diferenciais}
Horários de funcionamento: ${horarios}
Planos disponíveis: ${planos}`

  // ── BLOCO 3 — Caderno editorial ───────────────────────────────────────────────
  // Stable per tenant — prompt-cache eligible
  const escopo = c.caderno_editorial_escopo?.trim() ?? ''
  const tomEditorial = c.caderno_editorial_tom?.trim() ?? ''
  const restricoes = c.caderno_editorial_restricoes?.trim() ?? ''
  const objetivos = c.caderno_editorial_objetivos?.join('; ') ?? ''
  const exemplos = c.caderno_editorial_exemplos?.trim() ?? ''

  const argumentos = c.argumentos_venda?.length
    ? c.argumentos_venda
        .map((a) => `- [${a.contexto ?? 'geral'}] ${a.argumento ?? ''}${a.evidencia ? ` (${a.evidencia})` : ''}`)
        .join('\n')
    : 'usar abordagem consultiva padrão'

  const objecoes = c.objecoes_comuns?.length
    ? c.objecoes_comuns
        .map((o) => `- "${o.objecao ?? ''}": ${o.resposta_padrao ?? ''}`)
        .join('\n')
    : 'lidar com objeções de forma consultiva'

  const proibidas = c.palavras_proibidas?.length
    ? c.palavras_proibidas.join(', ')
    : 'nenhuma palavra proibida definida'

  const gatilhos = c.gatilhos_handoff
    ? Object.entries(c.gatilhos_handoff)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k)
        .join(', ') || 'padrão (desconto, solicitação explícita)'
    : 'padrão (desconto, solicitação explícita)'

  const bloco3Parts = [
    '[BLOCO 3 — Caderno editorial]',
    escopo ? `Escopo: ${escopo}` : '',
    tomEditorial ? `Tom editorial: ${tomEditorial}` : '',
    restricoes ? `Restrições: ${restricoes}` : '',
    objetivos ? `Objetivos: ${objetivos}` : '',
    exemplos ? `Exemplos de abordagem:\n${exemplos}` : '',
    `Argumentos de venda:\n${argumentos}`,
    `Tratamento de objeções:\n${objecoes}`,
    `Palavras proibidas (nunca usar): ${proibidas}`,
    `Transferir para humano quando: ${gatilhos}`,
  ].filter(Boolean)

  const bloco3 = bloco3Parts.join('\n')

  // ── BLOCO 4 — Regras inegociáveis ─────────────────────────────────────────────
  // Static — prompt-cache eligible across all tenants
  const bloco4 = `[BLOCO 4 — Regras inegociáveis]
- Nunca conceder desconto, bônus ou condição especial de preço. Se o lead pedir, chame imediatamente handoff_humano com motivo="desconto".
- Nunca confirmar horário fora do funcionamento — use consultar_disponibilidade_ae para checar.
- Nunca mencionar professor ou colaborador específico pelo nome.
- Se não souber a resposta, chame handoff_humano com motivo="duvida_complexa" em vez de inventar.
- Nunca inventar valores de plano — use apenas os valores em Planos disponíveis.
- Respostas curtas e objetivas — máximo 2 parágrafos por turno.
- Foco em agendar a Aula Experimental — esse é o único objetivo de conversão.`

  // ── BLOCO 5 — Histórico da conversa ──────────────────────────────────────────
  // Variable — NOT prompt-cached (changes every turn)
  const last20 = chatHistory.slice(-20)
  const historico = last20
    .map((msg) => {
      const role = msg.direcao === 'entrada' ? 'Lead' : 'CMO'
      return `${role}: ${msg.conteudo}`
    })
    .join('\n')

  const bloco5 = `[BLOCO 5 — Histórico da conversa (últimas ${last20.length} mensagens)]
${historico || '(início da conversa)'}`

  return [bloco1, bloco2, bloco3, bloco4, bloco5].join('\n\n')
}
