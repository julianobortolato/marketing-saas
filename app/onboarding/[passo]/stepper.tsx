'use client'

import { Check } from 'lucide-react'

const STEPS = [
  'Cadastro', 'Vertical', 'Logo', 'Identidade',
  'Fotos', 'Conexões', 'WhatsApp', 'Pronto',
]

interface StepperProps {
  current: number   // 1-8
  completed: number // highest completed step
}

export function Stepper({ current, completed }: StepperProps) {
  return (
    <nav aria-label="Progresso do wizard" className="w-full">
      <ol className="flex items-center justify-between">
        {STEPS.map((label, i) => {
          const step = i + 1
          const isDone = step < current || step <= completed
          const isActive = step === current
          return (
            <li key={step} className="flex flex-1 flex-col items-center gap-1">
              {/* connector line before (except first) */}
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : isDone || isActive ? 'bg-[#1A2E4A]' : 'bg-[#D1D5DB]'}`} />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-[#1A2E4A] text-white'
                      : isActive
                        ? 'border-2 border-[#1A2E4A] bg-white text-[#1A2E4A]'
                        : 'border border-[#D1D5DB] bg-white text-[#9CA3AF]'
                  }`}
                >
                  {isDone ? <Check size={14} /> : step}
                </span>
                <div className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'invisible' : isDone ? 'bg-[#1A2E4A]' : 'bg-[#D1D5DB]'}`} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#1A2E4A]' : isDone ? 'text-[#1A2E4A]' : 'text-[#9CA3AF]'}`}>
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
