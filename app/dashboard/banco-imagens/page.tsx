import { getBancoImagens, getSignedUrl } from '@/lib/queries/banco-imagens'
import type { ImagemComUrl } from './galeria'
import { Galeria } from './galeria'

export const dynamic = 'force-dynamic'

export default async function BancoImagensPage() {
  const imagens = await getBancoImagens(undefined, { limit: 100 })

  // Generate fresh signed URLs at render time (stored url_publica may be expired)
  const imagensComUrl: ImagemComUrl[] = await Promise.all(
    imagens.map(async (img) => ({
      ...img,
      signedUrl: await getSignedUrl('banco-imagens', img.storage_path, 3600),
    }))
  )

  const total = imagensComUrl.length
  const aprovadas = imagensComUrl.filter((i) => i.aprovada).length

  return (
    <div className="min-h-screen bg-[var(--prisma-ivory)] px-6 py-8">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-[var(--text-main)]">
              Banco de Imagens
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {total} imagem{total !== 1 ? 's' : ''} · {aprovadas} aprovada{aprovadas !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <Galeria imagens={imagensComUrl} />
      </div>
    </div>
  )
}
