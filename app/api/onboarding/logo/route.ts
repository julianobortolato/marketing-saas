export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ColorThief = require('colorthief')
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeLogoVision } from '@/lib/openai/vision-logo'
import { getCurrentUsuario } from '@/lib/queries/usuario'

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const usuario = await getCurrentUsuario()
  if (!usuario) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type))
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'arquivo muito grande (máx 5 MB)' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const uuid = randomUUID()
  const storagePath = `${usuario.tenant_id}/${uuid}.${ext}`

  // Upload to private bucket
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError)
    return NextResponse.json({ error: 'upload falhou: ' + uploadError.message }, { status: 500 })

  // colorthief: write to /tmp, extract palette, cleanup
  const tmpPath = path.join('/tmp', `logo-${uuid}.${ext}`)
  await fs.writeFile(tmpPath, buffer)

  let paletteHex: string[] = []
  try {
    const raw = await ColorThief.getPalette(tmpPath, 5)
    if (Array.isArray(raw)) {
      paletteHex = raw
        .filter((color: unknown) => color != null)
        .map((color: unknown) => {
          if (Array.isArray(color) && color.length >= 3) {
            return rgbToHex(color[0], color[1], color[2])
          }
          if (typeof color === 'object' && color !== null && 'r' in color) {
            const c = color as { r: number; g: number; b: number }
            return rgbToHex(c.r, c.g, c.b)
          }
          return null
        })
        .filter((hex: unknown): hex is string => hex !== null)
    }
  } finally {
    await fs.unlink(tmpPath).catch(() => null)
  }

  // Signed URL for Vision (1h TTL)
  const { data: signedData } = await admin.storage
    .from('logos')
    .createSignedUrl(storagePath, 3600)

  const signedUrl = signedData?.signedUrl ?? null
  let analysis = null

  if (signedUrl && paletteHex.length > 0) {
    try {
      analysis = await analyzeLogoVision(signedUrl, paletteHex)
    } catch {
      // Vision failure is non-blocking — return palette without names
    }
  }

  // Persistent signed URL for displaying logo later (also 1h — refreshed on page load)
  const { data: displayData } = await admin.storage
    .from('logos')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    storage_path: storagePath,
    display_url: displayData?.signedUrl ?? null,
    palette: paletteHex,
    analysis,
  })
}
