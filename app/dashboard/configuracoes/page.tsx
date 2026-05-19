import { getAcademiaConfig } from '@/lib/queries/academia-config'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { ConfigForm } from './config-form'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const [config, usuario] = await Promise.all([
    getAcademiaConfig(),
    getCurrentUsuario(),
  ])

  // Role defaults to 'owner' if usuario is not found (should not happen in practice
  // — middleware already guards this route)
  const role = usuario?.role ?? 'owner'

  // Extract scalar values from JSONB wrappers for form pre-fill
  const initialValues = config
    ? {
        nome_academia: config.nome_academia,
        bairro: config.bairro ?? '',
        cidade: config.cidade ?? '',
        raio_km: config.raio_km,
        tom_de_voz: (config.tom_de_voz as 'formal' | 'neutro' | 'coloquial') ?? 'neutro',
        diferenciais: config.diferenciais ?? [],
        horarios: config.horarios?.text ?? '',
        planos: config.planos?.text ?? '',
      }
    : null

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-8 text-xl font-bold uppercase tracking-wider text-foreground">
          Configurações
        </h1>
        <ConfigForm initialValues={initialValues} role={role} />
      </div>
    </div>
  )
}
