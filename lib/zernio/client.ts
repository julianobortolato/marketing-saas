import 'server-only'

const ZERNIO_BASE_URL = 'https://zernio.com/api/v1'

export interface ZernioPost {
  id: string
  accountId: string
  status: string
  scheduledFor: string
  publishedAt?: string
}

export interface ZernioCreatePostPayload {
  accountId: string
  scheduledFor: string
  mediaItems: Array<{ url: string }>
  caption?: string
}

function getZernioHeaders(): HeadersInit {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('ZERNIO_API_KEY not configured')
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export async function zernioCreatePost(payload: ZernioCreatePostPayload): Promise<ZernioPost> {
  const res = await fetch(`${ZERNIO_BASE_URL}/posts`, {
    method: 'POST',
    headers: getZernioHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<ZernioPost>
}

export async function zernioDeletePost(zernioPostId: string): Promise<void> {
  const res = await fetch(`${ZERNIO_BASE_URL}/posts/${zernioPostId}`, {
    method: 'DELETE',
    headers: getZernioHeaders(),
  })

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio delete error ${res.status}: ${text}`)
  }
}
