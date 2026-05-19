import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { NavItem } from '@/components/nav-item'
import { cn } from '@/lib/utils'
import type { Usuario, UsuarioRole } from '@/lib/queries/usuario'

interface AppShellProps {
  usuario: Usuario
  children: React.ReactNode
}

/**
 * Role badge styles per UI-SPEC § Role badge styles.
 * owner: #0F172A bg, white text, uppercase
 * manager: #334155 bg, white text
 * viewer: #F1F5F9 bg, #64748B text, border #E2E8F0
 */
function getRoleBadgeStyle(role: UsuarioRole): string {
  switch (role) {
    case 'owner':
      return 'bg-[#0F172A] text-white uppercase text-[10px] border-transparent'
    case 'manager':
      return 'bg-[#334155] text-white border-transparent'
    case 'viewer':
      return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
  }
}

function getRoleLabel(role: UsuarioRole): string {
  switch (role) {
    case 'owner':
      return 'owner'
    case 'manager':
      return 'manager'
    case 'viewer':
      return 'viewer'
  }
}

/**
 * Dashboard app shell — Server Component.
 * Renders 240px sidebar (logo, nav items, user bottom block) + main content area.
 * Muted "(em breve)" future items per UI-SPEC § Screen /dashboard/overview sidebar.
 */
export function AppShell({ usuario, children }: AppShellProps) {
  const emailInitial = usuario.nome
    ? usuario.nome.charAt(0).toUpperCase()
    : '?'

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar — 240px, #F8FAFC background */}
      <aside
        className="flex w-60 flex-shrink-0 flex-col bg-[#F8FAFC] border-r border-[#E2E8F0]"
        aria-label="Navegação principal"
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-[#E2E8F0]">
          <span className="text-lg font-bold uppercase tracking-wider text-[#0F172A]">
            Fitness UNIC
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2" aria-label="Menu">
          <NavItem href="/dashboard/overview" label="Visao Geral" />
          <NavItem href="/dashboard/configuracoes" label="Configuracoes" />
          <NavItem href="/dashboard/leads" label="Leads" />
          <NavItem href="/dashboard/aprovacoes" label="Aprovacoes" />
          <NavItem href="/dashboard/conteudo" label="Conteudo" disabled />
          <NavItem href="/dashboard/campanhas" label="Campanhas" disabled />
          <NavItem href="/dashboard/inteligencia" label="Inteligencia" disabled />
        </nav>

        {/* Bottom user block */}
        <div className="flex items-center gap-3 border-t border-[#E2E8F0] px-4 py-3">
          <Avatar className="size-8 flex-shrink-0">
            <AvatarFallback className="text-sm font-medium bg-[#E30613] text-white">
              {emailInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm text-[#0F172A] leading-none">
              {usuario.nome || 'Usuário'}
            </span>
            <Badge
              className={cn(
                'w-fit text-xs px-2 py-0.5 border',
                getRoleBadgeStyle(usuario.role)
              )}
            >
              {getRoleLabel(usuario.role)}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-auto bg-white">
        {children}
      </main>
    </div>
  )
}
