// Node Runtime — Edge timeout (25s) é insuficiente para processar múltiplos tenants.
// AP-PIPELINE-001: cron sempre em Node com maxDuration adequado ao plano Vercel.
export const runtime = 'nodejs'
export const maxDuration = 60 // Hobby plan max; upgrade para 300 quando Vercel Pro

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { gerarPostSemanal } from '@/lib/agents/gerador'

export async function POST(req: NextRequest) {
  // Resend inicializado dentro do handler — evita throw na coleta de page data do build
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ erro: 'nao_autorizado' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('id, nome, owner_email')
    .eq('ativo', true)
    .eq('ia_pausado', false)

  if (error) {
    return Response.json({ erro: error.message }, { status: 500 })
  }

  const origin = new URL(req.url).origin
  const resultados: Record<string, 'ok' | 'erro'> = {}

  for (const tenant of tenants ?? []) {
    try {
      await gerarPostSemanal(tenant.id, supabaseAdmin, origin)

      if (tenant.owner_email) {
        await resend.emails.send({
          from: 'Prisma CMO <noreply@prisma.app>',
          to: tenant.owner_email,
          subject: 'Seus posts da semana estão prontos para aprovação',
          html: `
            <p>Olá!</p>
            <p>O Prisma gerou os posts desta semana para sua empresa. Acesse o dashboard para aprovar antes de publicar.</p>
            <p><a href="${origin}/dashboard/aprovacoes">Ver posts para aprovação →</a></p>
            <p style="color:#888;font-size:12px;">Prisma — CMO autônomo para pequenas empresas</p>
          `,
        })
      }

      resultados[tenant.id] = 'ok'
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron/gerar-posts] tenant ${tenant.id}:`, msg)
      resultados[tenant.id] = 'erro'
    }
  }

  const total = Object.keys(resultados).length
  const erros = Object.values(resultados).filter(v => v === 'erro').length

  return Response.json({
    processados: total,
    ok: total - erros,
    erros,
    detalhes: resultados,
  })
}
