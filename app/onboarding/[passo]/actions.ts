'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { updateTenantFields, advanceOnboardingPasso } from '@/lib/queries/tenant'
import { patchBrandManual, ensureTenantConfig } from '@/lib/queries/brand-manual'
import { insertImagem } from '@/lib/queries/banco-imagens'
import { analyzeBrandForm } from '@/lib/openai/brand-analysis'
import {
  passo1Schema, passo2Schema, passo3ConfirmSchema, passo4Schema,
  type Passo1Input, type Passo2Input, type Passo3ConfirmInput, type Passo4Input,
} from '@/lib/validators/onboarding'

// ── Passo 1: dados básicos ───────────────────────────────────────────────────
export async function savePasso1(data: Passo1Input): Promise<{ error?: string }> {
  const parsed = passo1Schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  const { nome_dono, nome_empresa, cidade, whatsapp } = parsed.data

  const supabase = await createClient()
  await supabase.from('usuarios').update({ nome: nome_dono }).eq('id', usuario.id)

  const { error: tErr } = await updateTenantFields(usuario.tenant_id, {
    nome: nome_empresa,
    cidade,
    whatsapp_owner: whatsapp,
  })
  if (tErr) return { error: tErr }

  const { error: cfgErr } = await ensureTenantConfig(usuario.tenant_id, nome_empresa)
  if (cfgErr) return { error: cfgErr }

  await advanceOnboardingPasso(usuario.tenant_id, 2)
  return {}
}

// ── Passo 2: vertical ────────────────────────────────────────────────────────
export async function savePasso2(data: Passo2Input): Promise<{ error?: string }> {
  const parsed = passo2Schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  const { error } = await patchBrandManual(usuario.tenant_id, { vertical: parsed.data.vertical })
  if (error) return { error }

  await advanceOnboardingPasso(usuario.tenant_id, 3)
  return {}
}

// ── Passo 3: confirmar paleta do logo ────────────────────────────────────────
export async function savePasso3(data: Passo3ConfirmInput): Promise<{ error?: string }> {
  const parsed = passo3ConfirmSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  const { error } = await patchBrandManual(usuario.tenant_id, {
    visual: {
      cor_primaria: parsed.data.cor_primaria,
      cor_secundaria: parsed.data.cor_secundaria ?? parsed.data.palette[1] ?? parsed.data.cor_primaria,
      palette: parsed.data.palette,
      fonte_titulo: parsed.data.fonte_titulo,
      fonte_corpo: parsed.data.fonte_corpo,
      logo_url: parsed.data.logo_url,
    },
  })
  if (error) return { error }

  await advanceOnboardingPasso(usuario.tenant_id, 4)
  return {}
}

// ── Passo 3: skip logo ───────────────────────────────────────────────────────
export async function skipPasso3(): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }
  await patchBrandManual(usuario.tenant_id, { visual: { logo_url: null } })
  await advanceOnboardingPasso(usuario.tenant_id, 4)
  return {}
}

// ── Passo 4: formulário de marca ─────────────────────────────────────────────
export async function savePasso4(data: Passo4Input): Promise<{ error?: string }> {
  const parsed = passo4Schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  const analysis = await analyzeBrandForm(parsed.data)

  const { error } = await patchBrandManual(usuario.tenant_id, {
    tom_de_voz: analysis.tom_de_voz,
    publico_alvo: analysis.publico_alvo,
  })
  if (error) return { error }

  await advanceOnboardingPasso(usuario.tenant_id, 5)
  return {}
}

// ── Passo 5: confirmar imagens auto-tagueadas ────────────────────────────────
export async function savePasso5(images: Array<{
  storage_path: string
  url_publica: string
  categoria: string
  tags: string[]
  aprovada: boolean
}>): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  for (const img of images) {
    await insertImagem({
      tenant_id: usuario.tenant_id,
      storage_path: img.storage_path,
      url_publica: img.url_publica,
      categoria: img.categoria,
      tags: img.tags,
      largura: null,
      altura: null,
      vision_metadata: null,
      aprovada: img.aprovada,
    })
  }

  await advanceOnboardingPasso(usuario.tenant_id, 6)
  return {}
}

// ── Passo 6: OAuth skip (conexões opcionais) ─────────────────────────────────
export async function skipPasso6(): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }
  await advanceOnboardingPasso(usuario.tenant_id, 7)
  return {}
}

// ── Passo 7: avançar passo após conexão WhatsApp ─────────────────────────────
// Instance creation + persistence is handled by /api/evolution/criar-instancia.
// This action just advances the wizard step after the user confirms QR scan.
export async function savePasso7(): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }
  await advanceOnboardingPasso(usuario.tenant_id, 8)
  return {}
}

// ── Passo 8: concluir wizard ─────────────────────────────────────────────────
export async function concludeOnboarding(): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }
  await advanceOnboardingPasso(usuario.tenant_id, 9)
  return {}
}
