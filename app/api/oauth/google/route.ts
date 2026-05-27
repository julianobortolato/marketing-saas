import { NextResponse } from 'next/server'

// TODO: implement Google OAuth before first live tenant
// Requires: Google Calendar API scope + state param (CSRF) + token storage per tenant
export async function GET() {
  return NextResponse.json(
    { error: 'Google OAuth não implementado ainda.' },
    { status: 501 }
  )
}
