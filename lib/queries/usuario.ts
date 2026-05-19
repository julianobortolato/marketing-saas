import { createClient } from '@/lib/supabase/server'

export interface UsuarioRow {
  id: string
  tenant_id: string
  role: 'owner' | 'manager' | 'viewer'
  nome: string
}

/**
 * Returns the current authenticated user's record from public.usuarios, or null.
 * Reads role from the DB — never from JWT (CLAUDE.md inegociável).
 * Plan 04 may extend this function with additional fields.
 */
export async function getCurrentUsuario(): Promise<UsuarioRow | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, tenant_id, role, nome')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[getCurrentUsuario] error:', error.message)
    return null
  }

  return data as UsuarioRow | null
}
