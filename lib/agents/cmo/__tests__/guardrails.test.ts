/**
 * TDD RED: Guardrails test suite
 * Testing 8 behaviors + 2 for dispatchTool + 3 for buildSystemPrompt
 */
import { describe, it, expect, beforeAll } from 'vitest'

// These imports will fail until the modules are created (RED phase)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let applyGuardrails: typeof import('../guardrails').applyGuardrails
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let FALLBACK_DESCONTO: string
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let dispatchTool: typeof import('../tools').dispatchTool
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let buildSystemPrompt: typeof import('../system-prompt').buildSystemPrompt

beforeAll(async () => {
  const guardrailsModule = await import('../guardrails')
  applyGuardrails = guardrailsModule.applyGuardrails
  FALLBACK_DESCONTO = guardrailsModule.FALLBACK_DESCONTO

  const toolsModule = await import('../tools')
  dispatchTool = toolsModule.dispatchTool

  const promptModule = await import('../system-prompt')
  buildSystemPrompt = promptModule.buildSystemPrompt
})

// ============================================================
// Guardrails tests (8 behaviors)
// ============================================================

describe('applyGuardrails', () => {
  const baseContext = {
    palavrasProibidas: [] as string[],
    nomesProprios: [] as string[],
    horarios: null,
    planos: null,
    toolUseIterations: 0,
  }

  it('should return handoff_solicitado=true and motivo=desconto_detectado for input containing "desconto"', () => {
    const result = applyGuardrails('Posso oferecer um desconto especial para você', baseContext)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('desconto_detectado')
    expect(result.texto).toBe(FALLBACK_DESCONTO)
  })

  it('should return handoff_solicitado=true for input containing "cupom"', () => {
    const result = applyGuardrails('Temos um cupom disponível para você', baseContext)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('desconto_detectado')
  })

  it('should return handoff_solicitado=false and trimmed texto for normal text', () => {
    const result = applyGuardrails('  Olá! Como posso ajudar?  ', baseContext)
    expect(result.handoff_solicitado).toBe(false)
    expect(result.texto).toBe('Olá! Como posso ajudar?')
    expect(result.motivo).toBeUndefined()
  })

  it('should return handoff_solicitado=true and motivo=resposta_vazia for empty response', () => {
    const result = applyGuardrails('', baseContext)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('resposta_vazia')
  })

  it('should return motivo=resposta_muito_longa for response > 1200 chars', () => {
    const longText = 'a'.repeat(1201)
    const result = applyGuardrails(longText, baseContext)
    expect(result.motivo).toBe('resposta_muito_longa')
    expect(result.handoff_solicitado).toBe(true)
  })

  it('should detect palavras_proibidas from context and force handoff', () => {
    const ctx = { ...baseContext, palavrasProibidas: ['concorrente', 'rival'] }
    const result = applyGuardrails('Somos melhores que o concorrente da esquina', ctx)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('palavra_proibida')
  })

  it('should return handoff_solicitado=false for text with no palavras_proibidas match', () => {
    const ctx = { ...baseContext, palavrasProibidas: ['barato', 'promoção'] }
    const result = applyGuardrails('Temos planos que se encaixam no seu objetivo', ctx)
    expect(result.handoff_solicitado).toBe(false)
  })

  it('should return handoff_solicitado=true for toolUseIterations >= 5', () => {
    const ctx = { ...baseContext, toolUseIterations: 5 }
    const result = applyGuardrails('Processando...', ctx)
    expect(result.handoff_solicitado).toBe(true)
    expect(result.motivo).toBe('loop_tool_use')
  })
})

// ============================================================
// dispatchTool tests (2 behaviors)
// ============================================================

describe('dispatchTool', () => {
  const mockSupabase = {
    rpc: async () => ({ data: { ok: true }, error: null }),
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ data: null, error: null }) }) }),
    }),
  } as unknown as ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

  const ctx = {
    supabase: mockSupabase,
    tenantId: '00000000-0000-0000-0000-000000000001',
    conversaId: '00000000-0000-0000-0000-000000000002',
    leadId: '00000000-0000-0000-0000-000000000003',
  }

  it('should return { resultado: { ok: true } } for valid handoff_humano args', async () => {
    const validArgs = {
      conversa_id: ctx.conversaId,
      motivo: 'desconto',
      observacao_para_atendente: 'Lead pediu desconto',
    }
    const result = await dispatchTool('handoff_humano', validArgs, ctx)
    expect('resultado' in result).toBe(true)
  })

  it('should return { erro: "validation_failed" } for invalid handoff_humano args without throwing', async () => {
    const invalidArgs = { motivo: 'desconto' } // missing required fields
    const result = await dispatchTool('handoff_humano', invalidArgs, ctx)
    expect('erro' in result).toBe(true)
    if ('erro' in result) {
      expect(result.erro).toBe('validation_failed')
    }
  })
})

// ============================================================
// buildSystemPrompt tests (3 behaviors)
// ============================================================

describe('buildSystemPrompt', () => {
  const baseAcademiaConfig = {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    nome_academia: 'Academia Teste XYZ',
    bairro: 'Centro',
    cidade: 'São Paulo',
    raio_km: 5,
    tom_de_voz: 'formal',
    diferenciais: ['equipamentos modernos', '24h'],
    horarios: { text: 'Seg-Sex: 6h-22h, Sab: 8h-18h' },
    planos: { text: 'Mensal: R$ 90, Trimestral: R$ 240, Anual: R$ 840' },
    caderno_editorial_escopo: 'Foco em conversão de leads frios',
    caderno_editorial_tom: 'Consultivo e objetivo',
    caderno_editorial_restricoes: 'Não mencionar concorrentes',
    caderno_editorial_objetivos: ['agendar aula experimental'],
    caderno_editorial_exemplos: 'Exemplo de abordagem consultiva',
    argumentos_venda: [{ contexto: 'lead frio', argumento: 'qualidade', evidencia: 'nota alta' }],
    objecoes_comuns: [{ objecao: 'caro', resposta_padrao: 'investimento em saúde' }],
    palavras_proibidas: ['barato', 'desconto'],
    gatilhos_handoff: { desconto: true, pagamento: true },
    persona_cmo: null,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    tema: null,
  }

  it('should return string containing all 5 block markers', () => {
    const result = buildSystemPrompt({ academiaConfig: baseAcademiaConfig, chatHistory: [] })
    expect(result).toContain('[BLOCO 1')
    expect(result).toContain('[BLOCO 2')
    expect(result).toContain('[BLOCO 3')
    expect(result).toContain('[BLOCO 4')
    expect(result).toContain('[BLOCO 5')
  })

  it('should interpolate academia_config.nome_academia in Block 2', () => {
    const result = buildSystemPrompt({ academiaConfig: baseAcademiaConfig, chatHistory: [] })
    expect(result).toContain('Academia Teste XYZ')
  })

  it('should include last 20 chat messages in Block 5', () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      id: `msg-${i}`,
      tenant_id: baseAcademiaConfig.tenant_id,
      conversa_id: '00000000-0000-0000-0000-000000000002',
      evolution_message_id: null,
      direcao: i % 2 === 0 ? 'entrada' : 'saida' as 'entrada' | 'saida',
      tipo: 'texto' as const,
      conteudo: `Mensagem ${i + 1}`,
      enviada_em: new Date().toISOString(),
      status_envio: null,
    }))

    const result = buildSystemPrompt({ academiaConfig: baseAcademiaConfig, chatHistory: history })
    // Should contain message 6 (index 5 — first of last 20 in a 25-item list)
    expect(result).toContain('Mensagem 6')
    // Should contain message 25 (last item)
    expect(result).toContain('Mensagem 25')
    // Should NOT contain message 1-5 (first 5 are beyond last 20)
    expect(result).not.toContain('Mensagem 1\n')
    expect(result).not.toContain('Mensagem 2\n')
    expect(result).not.toContain('Mensagem 5\n')
  })
})
