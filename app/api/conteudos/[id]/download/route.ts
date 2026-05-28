import { NextRequest, NextResponse } from 'next/server'
import { zipSync, strToU8 } from 'fflate'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // RLS enforça tenant_id — client autenticado não acessa conteúdo de outro tenant
  const { data: conteudo, error } = await supabase
    .from('conteudos')
    .select('id, copy_principal, hashtags, imagem_composta_url, status')
    .eq('id', params.id)
    .eq('status', 'aprovado')
    .single()

  if (error || !conteudo) {
    return NextResponse.json(
      { error: 'Conteúdo não encontrado ou não aprovado' },
      { status: 404 },
    )
  }

  if (!conteudo.imagem_composta_url) {
    return NextResponse.json({ error: 'Imagem não disponível' }, { status: 422 })
  }

  // Busca PNG já renderizado no Storage
  const pngRes = await fetch(conteudo.imagem_composta_url)
  if (!pngRes.ok) {
    return NextResponse.json({ error: 'Falha ao buscar imagem' }, { status: 502 })
  }
  const pngBuffer = new Uint8Array(await pngRes.arrayBuffer())

  const hashtags = ((conteudo.hashtags as string[]) ?? []).join('\n')

  const zipBuffer = zipSync({
    'post.png': pngBuffer,
    'copy.txt': strToU8(conteudo.copy_principal ?? ''),
    'hashtags.txt': strToU8(hashtags),
  })

  // Persiste antes de enviar (CLAUDE.md §2.6)
  await supabase
    .from('conteudos')
    .update({ status: 'exportado' })
    .eq('id', conteudo.id)

  const slug = conteudo.id.slice(0, 8)
  return new NextResponse(Buffer.from(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="post-${slug}.zip"`,
    },
  })
}
