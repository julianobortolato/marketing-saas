import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUsuario } from '@/lib/queries/usuario'

const inviteSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  // Owners are created only via the signup trigger — not invited.
  role: z.enum(['manager', 'viewer'], {
    errorMap: () => ({ message: 'Role deve ser manager ou viewer.' }),
  }),
})

/**
 * POST /api/invite
 *
 * Invites a user (manager or viewer) into the caller's tenant.
 *
 * Security:
 * - Caller must be authenticated and have role='owner' (403 otherwise).
 * - tenant_id for the invited user is taken from the caller's getCurrentUsuario() result,
 *   never from the request body (CLAUDE.md inegociável — never trust client payload for tenant_id).
 * - createAdminClient (service role) is only called here — never in client components.
 *
 * Reconciliation of handle_new_user trigger:
 * The Plan 01 trigger fires on every auth.users INSERT and creates a ghost tenant + owner usuario
 * for the invited user. This endpoint compensates by:
 * 1. Calling inviteUserByEmail → captures invitedUserId.
 * 2. Reading the ghost tenant_id created by the trigger for invitedUserId.
 * 3. Updating the invited user's usuarios row: tenant_id = caller's tenant_id, role = requested role.
 * 4. Deleting the ghost tenant (guarded: never deletes the caller's own tenant).
 * 5. On any failure: deleteUser(invitedUserId) to prevent a half-reconciled ghost state.
 *
 * This is a Phase 1 compensation pattern. A future migration may make the trigger
 * invite-aware via raw_user_meta_data to eliminate the ghost-tenant creation entirely.
 */
export async function POST(request: NextRequest) {
  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 400 }
    )
  }

  const { email, role } = parsed.data

  // Authenticate and authorize: caller must be logged in and be an owner
  const supabase = await createClient()
  const {
    data: { user: callerAuthUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !callerAuthUser) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const callerUsuario = await getCurrentUsuario()

  if (!callerUsuario) {
    return NextResponse.json(
      { error: 'Usuário não encontrado.' },
      { status: 401 }
    )
  }

  if (callerUsuario.role !== 'owner') {
    return NextResponse.json(
      { error: 'Apenas owners podem convidar usuários.' },
      { status: 403 }
    )
  }

  const callerTenantId = callerUsuario.tenant_id

  // Use admin client (service role) for privileged operations — server-only
  const admin = createAdminClient()

  // Step 1: Send the invite
  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email)

  if (inviteError || !inviteData?.user?.id) {
    return NextResponse.json(
      { error: inviteError?.message ?? 'Erro ao enviar convite.' },
      { status: 500 }
    )
  }

  const invitedUserId = inviteData.user.id

  // Steps 2–5: Reconcile the ghost tenant created by handle_new_user trigger
  try {
    // Step 2: Read the ghost tenant_id assigned to the invited user by the trigger
    const { data: invitedUsuarioRow, error: readError } = await admin
      .from('usuarios')
      .select('tenant_id')
      .eq('id', invitedUserId)
      .single()

    if (readError || !invitedUsuarioRow) {
      throw new Error(
        `Não foi possível ler o usuario convidado: ${readError?.message ?? 'row not found'}`
      )
    }

    const ghostTenantId = invitedUsuarioRow.tenant_id as string

    // Step 3: Update the invited user's usuarios row to the caller's tenant + requested role
    const { error: updateError } = await admin
      .from('usuarios')
      .update({ tenant_id: callerTenantId, role })
      .eq('id', invitedUserId)

    if (updateError) {
      throw new Error(
        `Erro ao atualizar tenant do convidado: ${updateError.message}`
      )
    }

    // Step 4: Delete the ghost tenant — but NEVER the caller's own tenant
    if (ghostTenantId && ghostTenantId !== callerTenantId) {
      const { error: deleteError } = await admin
        .from('tenants')
        .delete()
        .eq('id', ghostTenantId)

      if (deleteError) {
        throw new Error(
          `Erro ao remover tenant fantasma: ${deleteError.message}`
        )
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (reconciliationError) {
    // Step 5: Rollback — delete the invited user so no ghost state remains
    await admin.auth.admin.deleteUser(invitedUserId)

    const message =
      reconciliationError instanceof Error
        ? reconciliationError.message
        : 'Erro interno.'

    // Never log the error with sensitive data in production (CLAUDE.md § Segurança)
    return NextResponse.json(
      { error: `Erro ao processar convite: ${message}` },
      { status: 500 }
    )
  }
}
