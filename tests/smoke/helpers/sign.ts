import { createHmac } from 'node:crypto'

export function signHmac(rawBody: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
}
