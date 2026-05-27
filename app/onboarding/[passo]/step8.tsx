'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { concludeOnboarding } from './actions'

interface PostPreview { id: string; formato: string; copy_principal: string }

export function Step8({ nomeEmpresa }: { nomeEmpresa: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<PostPreview[]>([])
  const [fotoAlerta, setFotoAlerta] = useState<'zero' | 'poucas' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/onboarding/posts', { method: 'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        setPosts(json.posts ?? [])
        setFotoAlerta(json.foto_alerta ?? null)
      })
      .catch(() => setError('Falha ao gerar posts. Você pode criar manualmente no dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleFinish() {
    await concludeOnboarding()
    router.push('/dashboard/aprovacoes')
  }

  const formatoLabel: Record<string, string> = {
    feed_1080: 'Feed', story_1920: 'Story', carousel_slide: 'Carrossel',
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Seus primeiros posts estão prontos!</h1>
        <p className="mt-1 text-sm text-[#64748B]">Criados com a identidade de {nomeEmpresa}.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="animate-spin text-[#1A2E4A]" size={36} />
          <p className="text-sm text-[#64748B]">Gerando posts com IA…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {fotoAlerta === 'zero' && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Sem fotos no banco, só copy foi gerada. Suba fotos para ativar o gerador visual.
            </div>
          )}
          {fotoAlerta === 'poucas' && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Você subiu poucas fotos. Adicione mais para melhorar a qualidade dos posts.
            </div>
          )}
          <div className="space-y-2 text-left">
            {posts.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-4">
                <CheckCircle2 size={20} className="shrink-0 text-green-500" />
                <div>
                  <span className="text-xs font-semibold uppercase text-[#64748B]">{formatoLabel[p.formato] ?? p.formato}</span>
                  <p className="text-sm text-[#1A2E4A]">{p.copy_principal}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Button onClick={handleFinish} disabled={loading} className="w-full bg-[#1A2E4A] text-white hover:bg-[#243d60] min-h-[44px]">
        Ver posts na fila de aprovação →
      </Button>
    </div>
  )
}
