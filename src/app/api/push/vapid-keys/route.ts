import { NextResponse } from 'next/server'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

/**
 * GET /api/push/vapid-keys
 *
 * Generates a fresh VAPID key pair for use in .env.local.
 * Only callable by admins. Run once during setup, then set:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
 *   VAPID_PRIVATE_KEY=<privateKey>
 *   VAPID_EMAIL=mailto:you@lobby.market
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const adminKey = process.env.ADMIN_SECRET ?? ''

  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const keys = webpush.generateVAPIDKeys()
  return NextResponse.json({
    publicKey:  keys.publicKey,
    privateKey: keys.privateKey,
    setup: {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY:  keys.publicKey,
      VAPID_PRIVATE_KEY:             keys.privateKey,
      VAPID_EMAIL:                   'mailto:admin@lobby.market',
    },
  })
}
