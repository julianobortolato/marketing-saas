'use server'

import { getCurrentUsuario } from '@/lib/queries/usuario'
import { getBrandManual, patchBrandManual } from '@/lib/queries/brand-manual'
import { marcaFormSchema, type MarcaFormValues } from '@/lib/validators/marca'

export async function saveMarca(data: MarcaFormValues): Promise<{ error?: string }> {
  const parsed = marcaFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const usuario = await getCurrentUsuario()
  if (!usuario) return { error: 'não autenticado' }

  const { visual, tom_de_voz, publico_alvo } = parsed.data

  // Read current brand_manual to preserve read-only visual fields
  // (palette and logo_url are set during onboarding, not editable here).
  // Merging server-side ensures we always write a complete visual sub-object (Option A).
  const current = await getBrandManual()
  const currentVisual = current.visual ?? {}

  const { error } = await patchBrandManual(usuario.tenant_id, {
    visual: {
      ...currentVisual,
      cor_primaria: visual.cor_primaria,
      cor_secundaria: visual.cor_secundaria,
      fonte_titulo: visual.fonte_titulo,
      fonte_corpo: visual.fonte_corpo,
    },
    tom_de_voz,
    publico_alvo,
  })

  return { error: error ?? undefined }
}
