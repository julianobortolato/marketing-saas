'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItemProps {
  href: string
  label: string
  disabled?: boolean
}

/**
 * Sidebar navigation item.
 * Active state: 3px left border #E30613 + #F1F5F9 bg + aria-current="page".
 * Disabled variant: muted text, "(em breve)" 12px suffix, no click action.
 */
export function NavItem({ href, label, disabled = false }: NavItemProps) {
  const pathname = usePathname()
  const isActive = !disabled && pathname === href

  if (disabled) {
    return (
      <div
        className={cn(
          'flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm',
          'text-[#94A3B8] cursor-not-allowed select-none'
        )}
        aria-disabled="true"
      >
        <span>{label}</span>
        <span className="text-xs text-[#94A3B8]">(em breve)</span>
      </div>
    )
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-[44px] items-center px-4 py-2 text-sm transition-colors',
        isActive
          ? 'border-l-[3px] border-[#E30613] bg-[#F1F5F9] text-[#0F172A] font-medium pl-[13px]'
          : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
      )}
    >
      {label}
    </Link>
  )
}
