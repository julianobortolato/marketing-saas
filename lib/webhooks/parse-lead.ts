import { z } from 'zod'

type LeadPayload = {
  origem: 'meta_form' | 'whatsapp'
  nome: string | null
  telefone: string | null
  remotejid: string | null
}

type ParseError = { error: string }

const metaFieldSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
})

const metaLeadSchema = z.object({
  field_data: z.array(metaFieldSchema).optional(),
  leadgen_id: z.union([z.string(), z.number()]).optional(),
})

const whatsappSchema = z.object({
  wa_id: z.string().optional(),
  from: z.string().optional(),
  pushName: z.string().optional(),
  messages: z
    .array(
      z.object({
        from: z.string().optional(),
        pushName: z.string().optional(),
      })
    )
    .optional(),
  profile: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
})

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 8 ? digits : null
}

/**
 * Parses a raw webhook body into a normalized lead insert shape.
 *
 * Detects two shapes:
 *   - Meta Lead Form: has `field_data` array or `leadgen_id` → origem='meta_form'
 *   - WhatsApp message: has `wa_id`, `from`, or `messages[0].from` → origem='whatsapp'
 *
 * Never throws. Returns `{ error }` for invalid JSON or unrecognized payloads.
 */
export function parseLeadPayload(rawBody: string): LeadPayload | ParseError {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { error: 'invalid_json' }
  }

  // Try Meta Lead Form shape
  const metaParsed = metaLeadSchema.safeParse(body)
  if (
    metaParsed.success &&
    (metaParsed.data.field_data !== undefined ||
      metaParsed.data.leadgen_id !== undefined)
  ) {
    const fields = metaParsed.data.field_data ?? []
    const getName = (): string | null => {
      const f = fields.find((x) => x.name === 'full_name')
      return f?.values[0] ?? null
    }
    const getPhone = (): string | null => {
      const f = fields.find((x) => x.name === 'phone_number')
      return normalizePhone(f?.values[0])
    }
    return {
      origem: 'meta_form',
      nome: getName(),
      telefone: getPhone(),
      remotejid: null,
    }
  }

  // Try WhatsApp shape
  const waParsed = whatsappSchema.safeParse(body)
  if (waParsed.success) {
    const wa = waParsed.data
    const phone =
      wa.wa_id ?? wa.from ?? wa.messages?.[0]?.from ?? null
    if (phone) {
      const nome =
        wa.pushName ??
        wa.profile?.name ??
        wa.messages?.[0]?.pushName ??
        null
      const normalized = normalizePhone(phone)
      return {
        origem: 'whatsapp',
        nome: nome ?? null,
        telefone: normalized,
        remotejid: normalized,
      }
    }
  }

  return { error: 'unrecognized_payload' }
}
