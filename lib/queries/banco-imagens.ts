import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface BancoImagemRow {
  id: string
  tenant_id: string
  storage_path: string
  url_publica: string
  categoria: string
  tags: string[]
  largura: number | null
  altura: number | null
  vision_metadata: Record<string, unknown> | null
  aprovada: boolean
  criado_em: string
}

export async function getBancoImagens(
  tenantId?: string,
  opts?: { categoria?: string; aprovada?: boolean; limit?: number; offset?: number }
): Promise<BancoImagemRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('banco_imagens')
    .select('*')
    .order('criado_em', { ascending: false })

  if (opts?.categoria) q = q.eq('categoria', opts.categoria)
  if (opts?.aprovada !== undefined) q = q.eq('aprovada', opts.aprovada)
  if (opts?.limit) q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1)

  const { data, error } = await q
  if (error) {
    console.error('[getBancoImagens]', error.message)
    return []
  }
  return data as BancoImagemRow[]
}

export async function insertImagem(
  row: Omit<BancoImagemRow, 'id' | 'criado_em'>
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('banco_imagens')
    .insert(row)
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function updateImagem(
  id: string,
  fields: Partial<Pick<BancoImagemRow, 'categoria' | 'tags' | 'aprovada'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('banco_imagens')
    .update(fields)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteImagens(ids: string[]): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('banco_imagens')
    .delete()
    .in('id', ids)
  return { error: error?.message ?? null }
}

export async function countImagens(tenantId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('banco_imagens')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  return count ?? 0
}

/** Generate a signed URL for a private bucket object (default TTL: 3600s = 1h) */
export async function getSignedUrl(
  bucket: 'logos' | 'banco-imagens',
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error) {
    console.error('[getSignedUrl]', error.message)
    return null
  }
  return data.signedUrl
}
