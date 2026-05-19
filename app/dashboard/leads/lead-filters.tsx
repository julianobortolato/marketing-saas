'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const STATUSES = [
  { value: '', label: 'Todos os status' },
  { value: 'novo', label: 'Novo' },
  { value: 'contatado', label: 'Contatado' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'perdido', label: 'Perdido' },
]

const ORIGENS = [
  { value: '', label: 'Todos os canais' },
  { value: 'meta_form', label: 'Meta Form' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google', label: 'Google' },
  { value: 'manual', label: 'Manual' },
]

interface LeadFiltersProps {
  current: {
    status?: string
    origem?: string
    from?: string
    to?: string
  }
}

export function LeadFilters({ current }: LeadFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/dashboard/leads?${params.toString()}`)
  }

  const hasFilters = Object.values(current).some(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={current.status ?? ''}
        onChange={(e) => updateFilter('status', e.target.value)}
        className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613]"
        aria-label="Filtrar por status"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={current.origem ?? ''}
        onChange={(e) => updateFilter('origem', e.target.value)}
        className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613]"
        aria-label="Filtrar por canal"
      >
        {ORIGENS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <label className="text-sm text-[#64748B]">De</label>
        <input
          type="date"
          value={current.from ?? ''}
          onChange={(e) => updateFilter('from', e.target.value)}
          className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613]"
          aria-label="Data início"
        />
        <label className="text-sm text-[#64748B]">Até</label>
        <input
          type="date"
          value={current.to ?? ''}
          onChange={(e) => updateFilter('to', e.target.value)}
          className="rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#E30613]"
          aria-label="Data fim"
        />
      </div>

      {hasFilters && (
        <button
          onClick={() => router.push('/dashboard/leads')}
          className="text-sm text-[#64748B] underline hover:text-[#0F172A]"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
