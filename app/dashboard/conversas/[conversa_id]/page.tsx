import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getConversaWithMessages } from '@/lib/queries/conversas'
import { getAcademiaConfig } from '@/lib/queries/academia-config'
import { ConversaActions } from './conversa-actions'
import { ManualReplyForm } from './manual-reply-form'

export const dynamic = 'force-dynamic'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  enviada: 'Enviada',
  falhou: 'Falhou',
}

interface PageProps {
  params: Promise<{ conversa_id: string }>
}

export default async function ConversaDetailPage({ params }: PageProps) {
  const { conversa_id } = await params

  if (!UUID_REGEX.test(conversa_id)) {
    redirect('/dashboard/conversas')
  }

  const [result, config] = await Promise.all([
    getConversaWithMessages(conversa_id),
    getAcademiaConfig(),
  ])

  if (!result) {
    redirect('/dashboard/conversas')
  }

  const { conversa, messages } = result
  const agentLabel = config?.nome_academia ?? 'CMO'

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A]">
            {conversa.leads?.nome ?? conversa.leads?.telefone ?? 'Lead'}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            {conversa.ia_ativa ? 'IA Ativa' : 'Handoff — atendimento humano'}
          </p>
        </div>
        <ConversaActions
          conversaId={conversa.id}
          iaAtiva={conversa.ia_ativa}
        />
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-[#64748B] text-sm py-8">
              Nenhuma mensagem ainda.
            </p>
          )}
          {messages.map((msg) => {
            const isEntrada = msg.direcao === 'entrada'
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isEntrada ? 'items-start' : 'items-end'}`}
              >
                <span className="text-xs text-[#64748B] px-1">
                  {isEntrada ? 'Lead' : agentLabel}
                </span>
                <div
                  className={[
                    'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
                    isEntrada
                      ? 'bg-[#F1F5F9] text-[#0F172A] rounded-tl-sm'
                      : 'bg-[#0F172A] text-white rounded-tr-sm',
                  ].join(' ')}
                >
                  {msg.conteudo}
                </div>
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs text-[#94A3B8]">
                    {new Date(msg.enviada_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.direcao === 'saida' && msg.status_envio && (
                    <Badge
                      className={[
                        'text-[10px] px-1.5 py-0 border',
                        msg.status_envio === 'enviada'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : msg.status_envio === 'falhou'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]',
                      ].join(' ')}
                    >
                      {STATUS_LABELS[msg.status_envio] ?? msg.status_envio}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!conversa.ia_ativa && (
        <ManualReplyForm conversaId={conversa.id} />
      )}
    </div>
  )
}
