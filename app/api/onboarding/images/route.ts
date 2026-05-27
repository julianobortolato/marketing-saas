export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { autoTagImages } from '@/lib/openai/vision-autotag'
import { getCategoriasForVertical } from '@/lib/queries/vertical-presets'
import { getBrandManual } from '@/lib/queries/brand-manual'
import { getCurrentUsuario } from '@/lib/queries/usuario'

const MAX_FILES = 20
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const usuario = await getCurrentUsuario()
  if (!usuario) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length)
    return NextResponse.json({ error: 'nenhum arquivo' }, { status: 400 })
  if (files.length > MAX_FILES)
    return NextResponse.json({ error: `máximo ${MAX_FILES} imagens` }, { status: 400 })

  // Validate each file
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type))
      return NextResponse.json({ error: `tipo inválido: ${f.name}` }, { status: 400 })
    if (f.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: `${f.name} muito grande (máx 20 MB)` }, { status: 400 })
  }

  const admin = createAdminClient()
  const brandManual = await getBrandManual()
  const vertical = brandManual.vertical ?? 'generico'
  const categorias = await getCategoriasForVertical(vertical)

  // Upload all files to private bucket
  const uploaded: Array<{ storagePath: string; signedUrl: string; originalName: string }> = []

  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${usuario.tenant_id}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await admin.storage
      .from('banco-imagens')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (error) continue

    const { data: signedData } = await admin.storage
      .from('banco-imagens')
      .createSignedUrl(storagePath, 3600)

    if (signedData?.signedUrl) {
      uploaded.push({ storagePath, signedUrl: signedData.signedUrl, originalName: file.name })
    }
  }

  if (!uploaded.length)
    return NextResponse.json({ error: 'upload falhou' }, { status: 500 })

  // Auto-tag with Vision (p-limit 5 concurrent)
  const tagResults = await autoTagImages(
    uploaded.map((u) => ({ signedUrl: u.signedUrl, storagePath: u.storagePath })),
    categorias
  )

  const resultado = uploaded.map((u, i) => ({
    storage_path: u.storagePath,
    display_url: u.signedUrl,
    original_name: u.originalName,
    categoria: tagResults[i]?.categoria ?? categorias[0] ?? 'generico',
    tags: tagResults[i]?.tags ?? [],
    aprovada: true,
  }))

  return NextResponse.json({ images: resultado })
}
