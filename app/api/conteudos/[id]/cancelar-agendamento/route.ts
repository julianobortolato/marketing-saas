/**
 * DELETE /api/conteudos/:id/cancelar-agendamento
 *
 * Cancela agendamento no Zernio e reverte conteudo.status para 'aprovado'.
 * Requer autenticação via cookie (RLS enforça tenant_id).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zernioDeletePost } from '@/lib/zernio/client'

export const runtime = 'nodejs'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // RLS enforça tenant_id — usuário só acessa conteúdo do próprio tenant
  const { data: conteudo, error } = await supabase
    .from('conteudos')
    .select('id, zernio_post_id, status')
    .eq('id', params.id)
    .eq('status', 'agendado')
    .single()

  if (error || !conteudo) {
    return NextResponse.json(
      { error: 'Conteúdo não encontrado ou não está agendado' },
      { status: 404 },
    )
  }

  // Cancelar no Zernio (best-effort: 404 é aceito se o post já não existe lá)
  if (conteudo.zernio_post_id) {
    try {
      await zernioDeletePost(conteudo.zernio_post_id as string)
    } catch (err) {
      console.error('[cancelar-agendamento] Zernio delete error:', (err as Error).message)
      return NextResponse.json(
        { error: 'Falha ao cancelar no Zernio. Tente novamente.' },
        { status: 502 },
      )
    }
  }

  // Persistir reversão para 'aprovado' + limpar campos de agendamento
  const { error: updateError } = await supabase
    .from('conteudos')
    .update({ status: 'aprovado', zernio_post_id: null, agendado_para: null })
    .eq('id', params.id)

  if (updateError) {
    console.error('[cancelar-agendamento] update error:', updateError.message)
    return NextResponse.json({ error: 'Falha ao reverter status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
