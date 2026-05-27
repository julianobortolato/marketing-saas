import OpenAI from 'openai'
import { ImageResponse } from '@vercel/og'
import { type SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES, DIMENSOES } from '@/lib/render/templates'
import { carregarFontes } from '@/lib/render/fonts'
import type { TemplateSlots, FormatoTemplate } from '@/lib/render/templates/types'

const LOGO_PLACEHOLDER = 'https://via.placeholder.com/200x60/1A2E4A/F0EEE8?text=LOGO'

export interface ResultadoGeracao {
  conteudo_id: string
  tenant_id: string
  imagem_composta_url: string
  copy_principal: string
  hashtags: string[]
  formato: FormatoTemplate
}

export async function gerarPostSemanal(
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>,
  origin: string,
): Promise<ResultadoGeracao> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // 1. Contexto do tenant
  const { data: config, error: configError } = await supabaseAdmin
    .from('tenant_config')
    .select('brand_manual, logo_url')
    .eq('tenant_id', tenantId)
    .single()

  if (configError) console.error('[gerador] tenant_config query error:', configError)

  if (!config?.brand_manual) {
    throw new Error(`brand_manual ausente para tenant ${tenantId}`)
  }

  // 2. Histórico recente — evitar repetição de tema
  const { data: historico } = await supabaseAdmin
    .from('conteudos')
    .select('copy_principal')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
    .limit(3)

  // 3. Fotos disponíveis (aprovadas pelo dono)
  const { data: fotos } = await supabaseAdmin
    .from('banco_imagens')
    .select('id, tags, url_publica')
    .eq('tenant_id', tenantId)
    .eq('aprovada', true)
    .limit(20)

  // 4. Prompt engine (prefere override de tenant se existir)
  const { data: promptRow } = await supabaseAdmin
    .from('prompts_agentes')
    .select('prompt')
    .eq('agente', 'gerador_copy')
    .eq('ativo', true)
    .or(`tenant_id.eq.${tenantId},and(escopo.eq.engine,tenant_id.is.null)`)
    .order('escopo', { ascending: false }) // 'tenant' > 'engine' — tenant-override primeiro
    .limit(1)
    .single()

  if (!promptRow) {
    throw new Error('Prompt gerador_copy não encontrado ou inativo')
  }

  // 5. GPT-4o — gera tema + copy + CTA + hashtags + seleciona foto por tags
  const userMessage = JSON.stringify({
    brand_manual: config.brand_manual,
    historico_recente: (historico ?? []).map(p => p.copy_principal),
    fotos_disponiveis: (fotos ?? []).map(f => ({ id: f.id, tags: f.tags })),
  })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: promptRow.prompt },
      { role: 'user', content: userMessage },
    ],
  })

  const gerado = JSON.parse(completion.choices[0].message.content ?? '{}') as {
    tema?: string
    copy_principal?: string
    cta?: string
    hashtags?: string[]
    foto_id?: string | null
    formato?: string
    justificativa_foto?: string
  }

  if (!gerado.copy_principal || !gerado.cta) {
    throw new Error('GPT-4o retornou JSON incompleto (copy_principal ou cta ausente)')
  }

  const formato: FormatoTemplate =
    gerado.formato === 'story' || gerado.formato === 'carousel_slide'
      ? gerado.formato
      : 'feed'

  // 6. URL da foto selecionada
  let fotoUrl = 'https://via.placeholder.com/1080x1080/1A2E4A/F0EEE8?text=foto'
  let fotoId: string | null = null

  if (gerado.foto_id) {
    const { data: foto } = await supabaseAdmin
      .from('banco_imagens')
      .select('id, url_publica')
      .eq('id', gerado.foto_id)
      .eq('tenant_id', tenantId) // garante isolamento cross-tenant
      .single()

    if (foto?.url_publica) {
      fotoUrl = foto.url_publica
      fotoId = foto.id
    }
  }

  // 7. Render direto (sem HTTP roundtrip — Node Runtime permite import direto)
  const slots: TemplateSlots = {
    foto_url: fotoUrl,
    copy_principal: gerado.copy_principal,
    cta: gerado.cta,
    logo_url: config.logo_url || LOGO_PLACEHOLDER,
    cor_primaria:
      (config.brand_manual as Record<string, Record<string, string>>)
        ?.identidade_visual?.cor_primaria ?? '#7B61C4',
    fonte_familia:
      (config.brand_manual as Record<string, Record<string, string>>)
        ?.identidade_visual?.fonte_familia as TemplateSlots['fonte_familia'],
    hashtags: (gerado.hashtags ?? []).slice(0, 5),
  }

  const { largura, altura } = DIMENSOES[formato]
  const familia = slots.fonte_familia ?? 'Plus Jakarta Sans'
  const fontes = await carregarFontes(origin, [familia])

  const imgResponse = new ImageResponse(
    TEMPLATES[formato](slots),
    { width: largura, height: altura, fonts: fontes },
  )
  const pngBuffer = await imgResponse.arrayBuffer()

  // 8. Upload PNG → Storage bucket 'posts' (público, path <tenantId>/<uuid>.png)
  const nomeArquivo = `${tenantId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('posts')
    .upload(nomeArquivo, pngBuffer, { contentType: 'image/png', upsert: false })

  if (uploadError) {
    throw new Error(`Upload falhou: ${uploadError.message}`)
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('posts')
    .getPublicUrl(nomeArquivo)

  // 9. INSERT em conteudos (ADR-MKT-001: persistir antes de enviar qualquer notificação)
  const { data: conteudo, error: insertError } = await supabaseAdmin
    .from('conteudos')
    .insert({
      tenant_id: tenantId,
      copy_principal: gerado.copy_principal,
      hashtags: gerado.hashtags ?? [],
      foto_id: fotoId,
      plataforma: 'instagram',
      formato,
      template_id: `${formato}_clean_v1`,
      imagem_composta_url: urlData.publicUrl,
      campanha_sugerida: {
        tema: gerado.tema,
        justificativa_foto: gerado.justificativa_foto,
      },
      status: 'pendente_aprovacao',
      fonte: 'cmo',
    })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(`INSERT conteudos falhou: ${insertError.message}`)
  }

  // 10. INSERT em aprovacoes (mesmo padrão do wizard)
  await supabaseAdmin.from('aprovacoes').insert({
    tenant_id: tenantId,
    tipo: 'conteudo',
    referencia_id: conteudo.id,
    status: 'pendente',
  })

  return {
    conteudo_id: conteudo.id,
    tenant_id: tenantId,
    imagem_composta_url: urlData.publicUrl,
    copy_principal: gerado.copy_principal,
    hashtags: gerado.hashtags ?? [],
    formato,
  }
}
