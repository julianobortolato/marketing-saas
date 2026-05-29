'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { batchDecisionSchema } from '@/lib/validators/aprovacao'
import { agendarPublicacao } from '@/lib/zernio/publicar'

export interface AgendamentoInfo {
  conteudo_id: string
  agendado_para: string
}

async function applyBatch(input: unknown, decision: 'aprovado' | 'rejeitado') {
  const parsed = batchDecisionSchema.safeParse({ ...(input as object), decision })
  if (!parsed.success) {
    return { error: parsed.error.flatten() }
  }

  const supabase = await createClient()

  const { data: tenantId } = await supabase.rpc('fn_tenant_id')
  if (!tenantId) {
    return {
      error: 'Não foi possível identificar a academia. Recarregue e tente novamente.',
    }
  }

  const { data, error } = await supabase
    .from('aprovacoes')
    .update({ status: decision })
    .in('id', parsed.data.ids)
    .eq('tipo', 'conteudo') // APROV-02 isolation: bulk action can NEVER flip a campanha row
    .eq('tenant_id', tenantId) // tenant_id from fn_tenant_id(), never from client
    .select('id, referencia_id')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/aprovacoes')

  // Agendar publicação via Zernio após aprovação
  if (decision === 'aprovado') {
    const agendamentos: AgendamentoInfo[] = []

    for (const row of data ?? []) {
      const referenciaId = row.referencia_id as string | null
      if (!referenciaId) continue

      try {
        const resultado = await agendarPublicacao(referenciaId, tenantId as string)
        agendamentos.push({
          conteudo_id: referenciaId,
          agendado_para: resultado.agendado_para.toISOString(),
        })
      } catch (err) {
        console.error('[approveBatch] agendarPublicacao error para', referenciaId, ':', (err as Error).message)
        // Continua: aprovação foi persistida, agendamento falhou graciosamente
      }
    }

    revalidatePath('/dashboard/aprovacoes')
    return { success: true, count: data?.length ?? 0, agendamentos }
  }

  return { success: true, count: data?.length ?? 0 }
}

export async function approveBatch(input: unknown) {
  return applyBatch(input, 'aprovado')
}

export async function rejectBatch(input: unknown) {
  return applyBatch(input, 'rejeitado')
}
