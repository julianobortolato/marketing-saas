'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { savePasso3, skipPasso3 } from './actions'
import type { BrandManual } from '@/lib/queries/brand-manual'

interface PaletteItem { hex: string; nome: string }

export function Step3({ brandManual }: { brandManual: BrandManual }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(brandManual.visual?.logo_url ?? null)
  // storage_path comes from API response embedded in each image result
  const [, setStoragePath] = useState<string | null>(null)
  const [palette, setPalette] = useState<PaletteItem[]>([])
  const [rawPalette, setRawPalette] = useState<string[]>(brandManual.visual?.palette ?? [])
  const [fonteSugerida, setFonteSugerida] = useState(brandManual.visual?.fonte_titulo ?? 'Inter')
  const [primary, setPrimary] = useState<string | null>(brandManual.visual?.cor_primaria ?? null)
  const [secondary, setSecondary] = useState<string | null>(brandManual.visual?.cor_secundaria ?? null)

  async function handleFile(file: File) {
    setUploading(true); setError(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/onboarding/logo', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro no upload'); return }
      setLogoUrl(json.display_url)
      setStoragePath(json.storage_path)
      setRawPalette(json.palette ?? [])
      const coresNomeadas: PaletteItem[] = json.analysis?.cores_nomeadas ?? json.palette?.map((h: string) => ({ hex: h, nome: h })) ?? []
      setPalette(coresNomeadas)
      setFonteSugerida(json.analysis?.fonte_sugerida ?? 'Inter')
      if (coresNomeadas.length > 0) setPrimary(coresNomeadas[0].hex)
      if (coresNomeadas.length > 1) setSecondary(coresNomeadas[1].hex)
    } catch {
      setError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally { setUploading(false) }
  }

  async function handleConfirm() {
    if (!primary) { setError('Selecione a cor primária'); return }
    setLoading(true)
    const result = await savePasso3({
      cor_primaria: primary,
      cor_secundaria: secondary ?? undefined,
      fonte_titulo: fonteSugerida,
      fonte_corpo: 'Inter',
      logo_url: logoUrl,
      palette: rawPalette,
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    router.push('/onboarding/4')
  }

  async function handleSkip() {
    setLoading(true)
    await skipPasso3()
    router.push('/onboarding/4')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Upload do logo</h1>
        <p className="mt-1 text-sm text-[#64748B]">Extrairemos a paleta de cores automaticamente.</p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E2E8F0] p-10 transition hover:border-[#1A2E4A]/40"
      >
        {uploading ? <Loader2 className="animate-spin text-[#1A2E4A]" size={32} />
          : logoUrl ? <img src={logoUrl} alt="logo" className="max-h-24 object-contain" />
          : <><Upload size={32} className="text-[#9CA3AF]" /><span className="text-sm text-[#9CA3AF]">Arraste ou clique para enviar</span></>}
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {/* Palette */}
      {palette.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#1A2E4A]">Clique para escolher as cores:</p>
          <div className="flex flex-wrap gap-2">
            {palette.map((c) => (
              <button key={c.hex} onClick={() => { if (!primary || primary === c.hex) { setPrimary(primary === c.hex ? null : c.hex) } else { setSecondary(secondary === c.hex ? null : c.hex) } }}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-medium transition ${primary === c.hex ? 'border-[#1A2E4A] ring-2 ring-[#1A2E4A]' : secondary === c.hex ? 'border-[#7B61C4] ring-2 ring-[#7B61C4]' : 'border-[#E2E8F0]'}`}>
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                <span>{c.nome}</span>
                {primary === c.hex && <span className="text-[#1A2E4A]">1ª</span>}
                {secondary === c.hex && <span className="text-[#7B61C4]">2ª</span>}
              </button>
            ))}
          </div>
          {fonteSugerida && <p className="text-xs text-[#64748B]">Tipografia sugerida: <strong>{fonteSugerida}</strong></p>}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleSkip} disabled={loading} className="flex-1">Pular este passo</Button>
        <Button onClick={handleConfirm} disabled={loading || !logoUrl} className="flex-1 bg-[#1A2E4A] text-white hover:bg-[#243d60]">
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar →'}
        </Button>
      </div>
    </div>
  )
}
