import { getBrandManual } from '@/lib/queries/brand-manual'
import { MarcaForm } from './marca-form'

export const dynamic = 'force-dynamic'

export default async function ManualMarcaPage() {
  const brandManual = await getBrandManual()

  return (
    <div className="min-h-screen bg-[var(--prisma-ivory)] px-6 py-8">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-8">
          <h1 className="text-xl font-bold uppercase tracking-wider text-[var(--text-main)]">
            Manual de Marca
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Identidade visual e tom de voz usados pelo Prisma para gerar conteúdo.
          </p>
        </div>
        <MarcaForm brandManual={brandManual} />
      </div>
    </div>
  )
}
