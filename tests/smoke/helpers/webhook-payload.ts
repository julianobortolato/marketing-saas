interface PayloadOpts {
  instanceName: string
  remotejid: string
  messageId: string
  text: string
  pushName?: string
  fromMe?: boolean
}

// Builds an Evolution V2 webhook payload matching the field names parsed in
// app/api/webhooks/evolution/route.ts (payload.instance, data.key.*, data.message.*).
export function buildEvolutionWebhookPayload(opts: PayloadOpts): Record<string, unknown> {
  return {
    instance: opts.instanceName,
    data: {
      key: {
        remoteJid: opts.remotejid,
        id: opts.messageId,
        fromMe: opts.fromMe ?? false,
      },
      pushName: opts.pushName ?? 'Smoke Lead',
      message: {
        conversation: opts.text,
      },
    },
  }
}
