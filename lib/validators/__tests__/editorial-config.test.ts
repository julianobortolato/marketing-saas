import { describe, it, expect } from 'vitest'
import { editorialConfigSchema } from '../editorial-config'

describe('editorialConfigSchema', () => {
  it('accepts a valid full editorial config object', () => {
    const result = editorialConfigSchema.safeParse({
      caderno_editorial_escopo: 'Foco em emagrecimento e ganho de massa',
      caderno_editorial_tom: 'Consultivo',
      caderno_editorial_restricoes: 'Não falar de desconto',
      caderno_editorial_objetivos: ['converter AE', 'qualificar lead'],
      caderno_editorial_exemplos: 'Exemplo: quando perguntarem sobre preços...',
      palavras_proibidas: ['barato', 'desconto'],
      persona_cmo: 'Bruno',
      gatilhos_handoff: { desconto: true, pagamento: true },
    })

    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all fields optional)', () => {
    const result = editorialConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects when caderno_editorial_escopo exceeds 5000 characters', () => {
    const result = editorialConfigSchema.safeParse({
      caderno_editorial_escopo: 'a'.repeat(5001),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toContain('caderno_editorial_escopo')
  })

  it('rejects when caderno_editorial_tom exceeds 500 characters', () => {
    const result = editorialConfigSchema.safeParse({
      caderno_editorial_tom: 'a'.repeat(501),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toContain('caderno_editorial_tom')
  })

  it('rejects when caderno_editorial_objetivos contains non-string entries', () => {
    const result = editorialConfigSchema.safeParse({
      caderno_editorial_objetivos: ['objetivo válido', 42, null],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path[0]).toBe('caderno_editorial_objetivos')
  })

  it('rejects when palavras_proibidas has more than 50 items', () => {
    const result = editorialConfigSchema.safeParse({
      palavras_proibidas: Array.from({ length: 51 }, (_, i) => `palavra${i}`),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path[0]).toBe('palavras_proibidas')
  })
})
