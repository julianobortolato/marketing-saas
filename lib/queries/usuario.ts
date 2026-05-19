import { createClient } from '@/lib/supabase/server'

export type UsuarioRole = 'owner' | 'manager' | 'viewer'

export interface Usuario {
  id: string
  tenant_id: string
  role: UsuarioRole
  nome: string
}

/**
 * Reads the current authenticated user's profile from public.usuarios.
 * Role is read from the DB (RLS-scoped), never from JWT claims.
 * Returns null when no authenticated session exists.
 */
export async function getCurrentUsuario(): Promise<Usuario | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, tenant_id, role, nome')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id as string,
    tenant_id: data.tenant_id as string,
    role: data.role as UsuarioRole,
    nome: data.nome as string,
  }
}
