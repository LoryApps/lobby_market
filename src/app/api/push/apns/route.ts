import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// APNs config from environment variables
const APNS_KEY_ID    = process.env.APNS_KEY_ID    ?? ''
const APNS_TEAM_ID   = process.env.APNS_TEAM_ID   ?? ''
const APNS_AUTH_KEY  = process.env.APNS_AUTH_KEY  ?? '' // PEM-encoded .p8 key
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID ?? 'com.lobbymarket.app'
const APNS_ENV       = process.env.APNS_ENV       ?? 'production' // 'sandbox' | 'production'

interface SendApnsBody {
  user_id: string
  title: string
  body: string
  badge?: number
  sound?: string
  url?: string   // Deep-link URL for tap handling
  type?: string  // Notification type for client routing
  topic_id?: string
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function base64url(input: Uint8Array | ArrayBuffer): string {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input)
  return Buffer.from(buf).toString('base64url')
}

async function buildApnsJwt(): Promise<string> {
  const header = { alg: 'ES256', kid: APNS_KEY_ID }
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: APNS_TEAM_ID, iat: now }

  const enc = new TextEncoder()
  const headerB64  = base64url(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)))
  const unsigned   = `${headerB64}.${payloadB64}`

  // Import the ES256 signing key
  const pemBody = APNS_AUTH_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyData = Buffer.from(pemBody, 'base64')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    enc.encode(unsigned)
  )

  return `${unsigned}.${base64url(new Uint8Array(signatureBuffer))}`
}

// ─── Send to one device token ─────────────────────────────────────────────────

async function sendToToken(
  token: string,
  { title, body, badge, sound, url, type, topic_id }: Omit<SendApnsBody, 'user_id'>
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const host = APNS_ENV === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com'

  const jwt = await buildApnsJwt()

  const apnsPayload = {
    aps: {
      alert: { title, body },
      badge: badge ?? 1,
      sound: sound ?? 'default',
    },
    // Custom data passed to the app
    ...(url       ? { url }       : {}),
    ...(type      ? { type }      : {}),
    ...(topic_id  ? { topic_id }  : {}),
  }

  const res = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(apnsPayload),
  })

  if (res.status === 200) return { ok: true, status: 200 }

  let reason: string | undefined
  try {
    const json = await res.json() as { reason?: string }
    reason = json.reason
  } catch {
    // no body
  }
  return { ok: false, status: res.status, reason }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Internal-only: require service role key
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_AUTH_KEY) {
    return NextResponse.json({ error: 'APNs not configured' }, { status: 503 })
  }

  const sendBody = (await req.json()) as SendApnsBody
  const { user_id, ...rest } = sendBody

  if (!user_id || !rest.title || !rest.body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch all APNs tokens for this user
  const supabase = await createClient()
  const { data: tokenRows, error } = await supabase
    .from('apns_tokens')
    .select('token, environment')
    .eq('user_id', user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!tokenRows || tokenRows.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // Send to each device token; collect results
  const results = await Promise.allSettled(
    tokenRows.map((row) => sendToToken(row.token, rest))
  )

  let sent = 0
  const stale: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const token  = tokenRows[i].token

    if (result.status === 'fulfilled') {
      if (result.value.ok) {
        sent++
      } else if (result.value.reason === 'BadDeviceToken' || result.value.status === 410) {
        // Token is invalid or unregistered — remove it
        stale.push(token)
      }
    }
  }

  // Clean up stale tokens
  if (stale.length > 0) {
    await supabase
      .from('apns_tokens')
      .delete()
      .in('token', stale)
  }

  return NextResponse.json({ sent, stale: stale.length })
}
