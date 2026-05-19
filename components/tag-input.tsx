'use client'

import { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MAX_CHIPS = 10

interface TagInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (value.length >= MAX_CHIPS) return

    onChange([...value, trimmed])
    setInputValue('')
  }

  function removeChip(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Input
        id={id}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          value.length >= MAX_CHIPS
            ? 'Limite de 10 itens atingido'
            : placeholder
        }
        disabled={disabled || value.length >= MAX_CHIPS}
        aria-label="Adicionar diferencial"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((chip, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-2.5 py-1 text-sm text-[#0F172A]"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(index)}
                disabled={disabled}
                className="ml-0.5 rounded-full text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
                aria-label={`Remover ${chip}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
