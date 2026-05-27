'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { savePasso7 } from './actions'

export function Step7({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter()
  const [numero, setNumero] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!numero.trim()) { setError('Informe o número'); return }
    setLoading(true); setError(null)
    const instanceName = `${tenantSlug}-${Date.now()}`
    try {
      const res = await fetch('/api/evolution/criar-instancia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, numero }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erro ao criar instância.')
      } else if (json.qrBase64) {
        setQrUrl(`data:image/png;base64,${json.qrBase64}`)
      } else {
        setError('QR code não recebido. Verifique o número e tente novamente.')
      }
    } catch {
      setError('Não foi possível conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    const result = await savePasso7()
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push('/onboarding/8')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Conectar WhatsApp</h1>
        <p className="mt-1 text-sm text-[#64748B]">Número comercial da empresa (não pessoal).</p>
      </div>

      {!qrUrl ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="numero">Número WhatsApp</Label>
            <Input id="numero" placeholder="5567912345678 (com código do país)" value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/onboarding/6')} className="flex-1">← Voltar</Button>
            <Button onClick={handleCreate} disabled={loading} className="flex-1 bg-[#1A2E4A] text-white hover:bg-[#243d60]">
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Gerar QR code →'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[#64748B]">Escaneie com o WhatsApp do celular:</p>
          <img src={qrUrl} alt="QR code WhatsApp" className="mx-auto h-56 w-56 rounded-xl border" />
          <p className="text-xs text-[#64748B]">WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleConfirm} disabled={loading} className="w-full bg-[#1A2E4A] text-white hover:bg-[#243d60]">
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Recebi a mensagem de teste →'}
          </Button>
        </div>
      )}
    </div>
  )
}
