import { NextResponse } from 'next/server'

// TODO: implement Meta OAuth before first live tenant
// Requires: Meta App Review + system user token + HMAC state param (CSRF)
export async function GET() {
  return NextResponse.json(
    { error: 'Meta OAuth não implementado ainda.' },
    { status: 501 }
  )
}
