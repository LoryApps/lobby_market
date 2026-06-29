import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_VALUES = ['truth', 'justice', 'liberty', 'community', 'progress'] as const
type OathValue = (typeof VALID_VALUES)[number]

export interface OathStatus {
  taken: boolean
  oath_at: string | null
  oath_value: OathValue | null
  roll_count: number
}

// ─── GET /api/oath ─────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profileRes, rollRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('civic_oath_at, civic_oath_value')
      .eq('id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('civic_oath_at', 'is', null),
  ])

  const profile = profileRes.data

  return NextResponse.json({
    taken: !!profile?.civic_oath_at,
    oath_at: profile?.civic_oath_at ?? null,
    oath_value: (profile?.civic_oath_value as OathValue | null) ?? null,
    roll_count: rollRes.count ?? 0,
  } satisfies OathStatus)
}

// ─── POST /api/oath ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { value?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const value = body.value as OathValue | undefined
  if (!value || !VALID_VALUES.includes(value)) {
    return NextResponse.json(
      { error: `value must be one of: ${VALID_VALUES.join(', ')}` },
      { status: 400 },
    )
  }

  // Idempotency — if already taken, return current oath
  const { data: existing } = await supabase
    .from('profiles')
    .select('civic_oath_at, civic_oath_value')
    .eq('id', user.id)
    .single()

  if (existing?.civic_oath_at) {
    return NextResponse.json({
      taken: true,
      oath_at: existing.civic_oath_at,
      oath_value: existing.civic_oath_value,
    })
  }

  // Record the oath
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({ civic_oath_at: now, civic_oath_value: value })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated roll count
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('civic_oath_at', 'is', null)

  return NextResponse.json({
    taken: true,
    oath_at: now,
    oath_value: value,
    roll_count: count ?? 0,
  } satisfies OathStatus)
}
