'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { savePasso2 } from './actions'
import type { VerticalPreset } from '@/lib/queries/vertical-presets'

const ICONS: Record<string, string> = {
  fitness: '🏋️', gastronomia: '🍽️', beleza: '💅', generico: '🏢',
}
const LABELS: Record<string, string> = {
  fitness: 'Fitness', gastronomia: 'Gastronomia', beleza: 'Beleza', generico: 'Outro',
}

export function Step2({
  presets, current,
}: {
  presets: VerticalPreset[]
  current?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(current ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(vertical: string) {
    setSelected(vertical)
    setLoading(true)
    setError(null)
    const result = await savePasso2({ vertical: vertical as 'fitness' | 'gastronomia' | 'beleza' | 'generico' })
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push('/onboarding/3')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Qual é o seu segmento?</h1>
        <p className="mt-1 text-sm text-[#64748B]">Isso personaliza os tipos de conteúdo sugeridos.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {presets.map((p) => (
          <button
            key={p.vertical}
            onClick={() => handleSelect(p.vertical)}
            disabled={loading}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-6 transition-all ${
              selected === p.vertical
                ? 'border-[#1A2E4A] bg-[#1A2E4A]/5'
                : 'border-[#E2E8F0] hover:border-[#1A2E4A]/40'
            }`}
          >
            <span className="text-3xl">{ICONS[p.vertical] ?? '📁'}</span>
            <span className="text-sm font-semibold text-[#1A2E4A]">{LABELS[p.vertical] ?? p.vertical}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center"><Loader2 className="animate-spin text-[#1A2E4A]" /></div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
