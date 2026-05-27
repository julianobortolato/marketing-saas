'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { skipPasso6 } from './actions'

export function Step6() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSkip() {
    setLoading(true)
    await skipPasso6()
    router.push('/onboarding/7')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Conectar contas</h1>
        <p className="mt-1 text-sm text-[#64748B]">Opcional agora — configure depois em Configurações.</p>
      </div>

      <div className="space-y-3">
        <a href="/api/oauth/meta"
          className="flex items-center gap-3 rounded-xl border-2 border-[#E2E8F0] p-4 transition hover:border-[#1A2E4A]/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]">
            <span className="text-lg font-bold text-white">f</span>
          </div>
          <div>
            <p className="font-semibold text-[#1A2E4A]">Conectar Meta</p>
            <p className="text-xs text-[#64748B]">Facebook & Instagram para publicação automática</p>
          </div>
        </a>

        <a href="/api/oauth/google"
          className="flex items-center gap-3 rounded-xl border-2 border-[#E2E8F0] p-4 transition hover:border-[#1A2E4A]/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E2E8F0]">
            <span className="text-lg">G</span>
          </div>
          <div>
            <p className="font-semibold text-[#1A2E4A]">Conectar Google</p>
            <p className="text-xs text-[#64748B]">Google Calendar para agendamentos (Fase 8)</p>
          </div>
        </a>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/onboarding/5')} className="flex-1">← Voltar</Button>
        <Button onClick={handleSkip} disabled={loading} className="flex-1 bg-[#1A2E4A] text-white hover:bg-[#243d60]">
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Pular por agora →'}
        </Button>
      </div>
    </div>
  )
}
