/**
 * Shared types for the OpenAI client and agent modules.
 * ADR-MKT-001 §10: observability, usage tracking.
 */

/** Token usage and cost statistics for one LLM invocation. */
export interface UsageStats {
  tokens_entrada: number
  tokens_saida: number
  custo_usd: number
  duracao_ms: number
}

/**
 * Discriminated union result from a tool call dispatch.
 * Never throws — returns structured error instead.
 */
export type ToolCallResult =
  | { resultado: unknown }
  | { erro: string }
