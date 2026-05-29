import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUsuario } from '@/lib/queries/usuario'

// AES-256-GCM encryption; key comes from ENCRYPTION_KEY env (64 hex chars = 32 bytes).
function encryptApiKey(plaintext: string): string {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY env não configurada (deve ter 64 hex chars)')
  }
  const key = Buffer.from(keyHex, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export async function POST(req: NextRequest) {
  const usuario = await getCurrentUsuario()
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const apiUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: 'Evolution API não configurada. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.' },
      { status: 503 }
    )
  }

  let body: { instanceName?: string; numero?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body inválido' }, { status: 400 })
  }

  const { instanceName, numero } = body
  if (!instanceName || !numero) {
    return NextResponse.json({ error: 'instanceName e numero são obrigatórios' }, { status: 400 })
  }

  const numeroLimpo = numero.replace(/\D/g, '')

  let qrBase64: string | null = null
  try {
    const res = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true, number: numeroLimpo }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[criar-instancia] Evolution error', res.status, text)
      return NextResponse.json(
        { error: `Evolution API retornou ${res.status}. Verifique a URL e a chave.` },
        { status: 502 }
      )
    }

    const json = await res.json()
    qrBase64 = json?.qrcode?.base64 ?? null
  } catch (err) {
    console.error('[criar-instancia] fetch error', err)
    return NextResponse.json(
      { error: 'Não foi possível conectar à Evolution API.' },
      { status: 502 }
    )
  }

  // Persist to evolution_instances — api_key encrypted at rest
  let apiKeyEncrypted: string
  try {
    apiKeyEncrypted = encryptApiKey(apiKey)
  } catch (err) {
    console.error('[criar-instancia] encryption error', err)
    return NextResponse.json(
      { error: 'Erro de configuração interna (ENCRYPTION_KEY).' },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { error: dbErr } = await supabase.from('evolution_instances').upsert(
    {
      tenant_id: usuario.tenant_id,
      instance_name: instanceName,
      numero_whatsapp: numeroLimpo,
      api_key_encrypted: apiKeyEncrypted,
      webhook_secret: process.env.EVOLUTION_WEBHOOK_SECRET ?? '',
      ativo: true,
    },
    { onConflict: 'instance_name' }
  )

  if (dbErr) {
    console.error('[criar-instancia] db error', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ qrBase64 })
}
