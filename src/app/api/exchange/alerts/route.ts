import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string
  topic_id: string
  threshold: number
  direction: 'above' | 'below'
  is_triggered: boolean
  triggered_at: string | null
  created_at: string
  topic: {
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
}

export interface AlertsResponse {
  alerts: PriceAlert[]
  total: number
}

// ─── GET — list user's alerts ─────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('exchange_price_alerts')
    .select(`
      id,
      topic_id,
      threshold,
      direction,
      is_triggered,
      triggered_at,
      created_at,
      topic:topics (
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const alerts = (rows ?? []).map((r) => ({
    id: r.id as string,
    topic_id: r.topic_id as string,
    threshold: r.threshold as number,
    direction: r.direction as 'above' | 'below',
    is_triggered: r.is_triggered as boolean,
    triggered_at: r.triggered_at as string | null,
    created_at: r.created_at as string,
    topic: r.topic as PriceAlert['topic'],
  }))

  return NextResponse.json({ alerts, total: alerts.length } satisfies AlertsResponse)
}

// ─── POST — create a new alert ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { topic_id, threshold, direction } = body ?? {}

  if (
    typeof topic_id !== 'string' ||
    typeof threshold !== 'number' ||
    threshold < 1 ||
    threshold > 99 ||
    (direction !== 'above' && direction !== 'below')
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Verify topic exists
  const { data: topic } = await supabase
    .from('topics')
    .select('id, blue_pct')
    .eq('id', topic_id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // If the alert is already satisfied at creation time, mark immediately
  const currentPct = Math.round(topic.blue_pct ?? 50)
  const alreadyTriggered =
    direction === 'above' ? currentPct >= threshold : currentPct <= threshold

  const { data: inserted, error } = await supabase
    .from('exchange_price_alerts')
    .insert({
      user_id: user.id,
      topic_id,
      threshold,
      direction,
      is_triggered: alreadyTriggered,
      triggered_at: alreadyTriggered ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Alert already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id, already_triggered: alreadyTriggered })
}

// ─── DELETE — remove an alert ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('exchange_price_alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
