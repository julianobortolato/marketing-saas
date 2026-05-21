import { getConversas } from '@/lib/queries/conversas'
import { getCurrentUsuario } from '@/lib/queries/usuario'
import { Card, CardContent } from '@/components/ui/card'
import { ConversasTable } from './conversas-table'

export const dynamic = 'force-dynamic'

export default async function ConversasPage() {
  const [conversas, usuario] = await Promise.all([
    getConversas(),
    getCurrentUsuario(),
  ])

  const role = usuario?.role ?? 'viewer'

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
          Conversas
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {conversas.length === 0 ? (
          <Card className="border-[#E2E8F0] bg-[#F8FAFC]">
            <CardContent className="p-6 text-center text-[#64748B]">
              Nenhuma conversa ainda.
            </CardContent>
          </Card>
        ) : (
          <ConversasTable conversas={conversas} role={role} />
        )}
      </div>
    </div>
  )
}
