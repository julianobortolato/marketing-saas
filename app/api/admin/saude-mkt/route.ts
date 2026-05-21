import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { buildSaudeMktPayload } from '@/lib/queries/saude-mkt'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const usuario = await getCurrentUsuario()

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 401 }
      )
    }

    if (usuario.role !== 'owner') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const tenantId = usuario.tenant_id

    const payload = await buildSaudeMktPayload(tenantId)

    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    const errCode = err instanceof Error ? err.name : 'unknown'
    console.error('[saude-mkt] internal error', { errCode })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
