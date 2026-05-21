import { getEditorialConfig } from '@/lib/queries/academia-config'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { EditorialForm } from './editorial-form'

export const dynamic = 'force-dynamic'

export default async function EditorialPage() {
  const [config, usuario] = await Promise.all([
    getEditorialConfig(),
    getCurrentUsuario(),
  ])

  const role = usuario?.role ?? 'owner'

  const initialValues = config
    ? {
        caderno_editorial_escopo: config.caderno_editorial_escopo ?? '',
        caderno_editorial_tom: config.caderno_editorial_tom ?? '',
        caderno_editorial_restricoes: config.caderno_editorial_restricoes ?? '',
        caderno_editorial_objetivos: config.caderno_editorial_objetivos ?? [],
        caderno_editorial_exemplos: config.caderno_editorial_exemplos ?? '',
        palavras_proibidas: config.palavras_proibidas ?? [],
        persona_cmo: config.persona_cmo ?? '',
        gatilhos_handoff: config.gatilhos_handoff ?? undefined,
      }
    : null

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-8 text-xl font-bold uppercase tracking-wider text-foreground">
          Caderno Editorial
        </h1>
        <EditorialForm initialValues={initialValues} role={role} />
      </div>
    </div>
  )
}
