'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { savePasso5 } from './actions'

interface TaggedImage {
  storage_path: string
  display_url: string
  original_name: string
  categoria: string
  tags: string[]
  aprovada: boolean
}

// vertical is used by the API route server-side (via brand_manual) — prop reserved for future client-side use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Step5({ vertical }: { vertical: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState<TaggedImage[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList) {
    if (files.length + images.length > 20) { setError('Máximo 20 imagens'); return }
    setUploading(true); setError(null)
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/onboarding/images', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro no upload'); return }
      setImages(prev => [...prev, ...json.images])
    } finally { setUploading(false) }
  }

  function toggleAprovada(idx: number) {
    setImages(prev => prev.map((img, i) => i === idx ? { ...img, aprovada: !img.aprovada } : img))
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    const result = await savePasso5(images.map(img => ({
      storage_path: img.storage_path,
      url_publica: img.display_url,
      categoria: img.categoria,
      tags: img.tags,
      aprovada: img.aprovada,
    })))
    if (result.error) { setError(result.error); setSaving(false); return }
    router.push('/onboarding/6')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E4A]">Banco de imagens</h1>
        <p className="mt-1 text-sm text-[#64748B]">Envie 10-20 fotos. A IA auto-classifica cada uma.</p>
      </div>

      {/* Drop zone */}
      <div onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E2E8F0] p-8 transition hover:border-[#1A2E4A]/40">
        {uploading ? <Loader2 className="animate-spin text-[#1A2E4A]" size={28} />
          : <><Upload size={28} className="text-[#9CA3AF]" /><span className="text-sm text-[#9CA3AF]">Arraste ou clique para enviar (máx 20)</span></>}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files) }} />
      </div>

      {/* Gallery */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.storage_path} className={`relative rounded-lg overflow-hidden border-2 transition ${img.aprovada ? 'border-[#1A2E4A]' : 'border-[#E2E8F0] opacity-50'}`}>
              <img src={img.display_url} alt={img.original_name} className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-1">
                <p className="truncate text-[10px] text-white">{img.categoria}</p>
              </div>
              <button onClick={() => removeImage(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-gray-600 hover:text-red-500"><X size={12} /></button>
              <input type="checkbox" checked={img.aprovada} onChange={() => toggleAprovada(i)} className="absolute left-1 top-1" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/onboarding/4')} className="flex-1">← Voltar</Button>
        <Button onClick={handleSave} disabled={saving || images.length === 0} className="flex-1 bg-[#1A2E4A] text-white hover:bg-[#243d60]">
          {saving ? <Loader2 className="animate-spin" size={18} /> : `Confirmar ${images.length} foto${images.length !== 1 ? 's' : ''} →`}
        </Button>
      </div>
    </div>
  )
}
