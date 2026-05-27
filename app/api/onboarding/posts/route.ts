export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBrandManual } from '@/lib/queries/brand-manual'
import { getBancoImagens, getSignedUrl } from '@/lib/queries/banco-imagens'
import { getCurrentUsuario } from '@/lib/queries/usuario'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const FORMATOS = [
  { formato: 'feed',           label: 'Feed Instagram' },
  { formato: 'story',          label: 'Story' },
  { formato: 'carousel_slide', label: 'Carrossel' },
] as const

export async function POST(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _req: NextRequest
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const usuario = await getCurrentUsuario()
  if (!usuario) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const brandManual = await getBrandManual()
  const tom = brandManual.tom_de_voz
  const publico = brandManual.publico_alvo
  const nomeEmpresa = brandManual.identidade?.nome_empresa ?? ''

  if (!tom?.descricao)
    return NextResponse.json({ error: 'brand_manual incompleto' }, { status: 400 })

  // Get top approved images (Vision-tagged, most recent first)
  const imagens = await getBancoImagens(usuario.tenant_id, { aprovada: true, limit: 10 })

  const systemPrompt = `Você é um criador de conteúdo para redes sociais para a empresa "${nomeEmpresa}".
Tom de voz: ${tom.descricao}
Público-alvo: ${publico?.descricao ?? ''}
Diferencial: ${publico?.diferencial ?? ''}
Palavras preferidas: ${tom.palavras_preferidas?.join(', ') ?? ''}
Palavras a evitar: ${tom.palavras_a_evitar?.join(', ') ?? ''}

Crie posts para redes sociais que sejam autênticos e conversem diretamente com esse público.`

  const admin = createAdminClient()
  const posts: Array<{
    formato: string
    copy_principal: string
    copy_legenda: string
    hashtags: string[]
    foto_url: string | null
  }> = []

  for (const { formato, label } of FORMATOS) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Crie um post para ${label}. Formato JSON:\n{"copy_principal":"<texto principal curto, max 80 chars>","copy_legenda":"<legenda completa para Instagram, max 200 chars>","hashtags":["<tag1>","<tag2>","<tag3>"]}`,
          },
        ],
      })

      const content = resp.choices[0]?.message?.content ?? ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null

      // Pick best photo for this format by matching tags
      const imagem = imagens[posts.length] ?? imagens[0] ?? null
      let fotoUrl: string | null = null
      if (imagem) {
        fotoUrl = await getSignedUrl('banco-imagens', imagem.storage_path, 3600)
      }

      posts.push({
        formato,
        copy_principal: parsed?.copy_principal ?? `Venha nos conhecer, ${nomeEmpresa}!`,
        copy_legenda: parsed?.copy_legenda ?? '',
        hashtags: parsed?.hashtags?.slice(0, 5) ?? [],
        foto_url: fotoUrl,
      })
    } catch {
      posts.push({
        formato,
        copy_principal: `Venha nos conhecer, ${nomeEmpresa}!`,
        copy_legenda: '',
        hashtags: [],
        foto_url: null,
      })
    }
  }

  // Persist: conteudos + aprovacoes
  const savedPosts: Array<{ id: string; formato: string; copy_principal: string }> = []

  for (const p of posts) {
    const { data: conteudo } = await admin
      .from('conteudos')
      .insert({
        tenant_id: usuario.tenant_id,
        formato: p.formato,
        copy_principal: p.copy_principal,
        copy_legenda: p.copy_legenda,
        hashtags: p.hashtags,
        foto_url: p.foto_url,
        status: 'pendente_aprovacao',
        fonte: 'wizard',
      })
      .select('id')
      .single()

    if (conteudo) {
      await admin.from('aprovacoes').insert({
        tenant_id: usuario.tenant_id,
        tipo: 'conteudo',
        referencia_id: conteudo.id,
        status: 'pendente',
      })
      savedPosts.push({ id: conteudo.id, formato: p.formato, copy_principal: p.copy_principal })
    }
  }

  const fotoAlerta =
    imagens.length === 0
      ? 'zero'
      : imagens.length < 3
        ? 'poucas'
        : null

  return NextResponse.json({ posts: savedPosts, foto_alerta: fotoAlerta })
}
