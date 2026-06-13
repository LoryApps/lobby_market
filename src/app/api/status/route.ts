import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

export interface StatusMetrics {
  topics: { total: number; active: number; voting: number; laws: number; proposed: number; failed: number }
  votes: number
  arguments: number
  debates: number
  coalitions: number
  users: number
}

export interface StatusEvent {
  type: 'law_established' | 'topic_activated' | 'debate_concluded'
  id: string
  label: string
  category: string | null
  occurred_at: string
}

export interface ComponentStatus {
  name: string
  status: 'operational' | 'degraded' | 'outage'
  latency_ms: number | null
  message?: string
}

export interface PlatformStatus {
  overall: 'operational' | 'degraded' | 'outage'
  checked_at: string
  metrics: StatusMetrics
  components: ComponentStatus[]
  recent_events: StatusEvent[]
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  const t0 = Date.now()
  const components: ComponentStatus[] = []
  let dbOk = false

  try {
    const supabase = await createClient()

    // ── Database health probe ──────────────────────────────────────────────────
    const dbStart = Date.now()
    const [topicsRes, argumentsRes, debatesRes, coalitionsRes, usersRes, recentLawsRes, recentActivatedRes] =
      await Promise.all([
        supabase.from('topics').select('status, total_votes'),
        supabase.from('arguments').select('id', { count: 'exact', head: true }),
        supabase.from('debates').select('id', { count: 'exact', head: true }),
        supabase.from('coalitions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        // Recent laws
        supabase
          .from('topics')
          .select('id, statement, category, updated_at')
          .eq('status', 'law')
          .order('updated_at', { ascending: false })
          .limit(5),
        // Recently activated
        supabase
          .from('topics')
          .select('id, statement, category, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
    const dbLatency = Date.now() - dbStart

    dbOk = !topicsRes.error
    components.push({
      name: 'Database',
      status: topicsRes.error ? 'outage' : dbLatency > 2000 ? 'degraded' : 'operational',
      latency_ms: dbLatency,
      message: topicsRes.error ? topicsRes.error.message : undefined,
    })

    // ── Metrics ────────────────────────────────────────────────────────────────
    const topicRows = topicsRes.data ?? []
    const metrics: StatusMetrics = {
      topics: {
        total: topicRows.length,
        active: topicRows.filter((r) => r.status === 'active').length,
        voting: topicRows.filter((r) => r.status === 'voting').length,
        laws: topicRows.filter((r) => r.status === 'law').length,
        proposed: topicRows.filter((r) => r.status === 'proposed').length,
        failed: topicRows.filter((r) => r.status === 'failed').length,
      },
      votes: topicRows.reduce((s, r) => s + (r.total_votes ?? 0), 0),
      arguments: argumentsRes.count ?? 0,
      debates: debatesRes.count ?? 0,
      coalitions: coalitionsRes.count ?? 0,
      users: usersRes.count ?? 0,
    }

    // ── API self-check ─────────────────────────────────────────────────────────
    const apiLatency = Date.now() - t0
    components.push({
      name: 'API',
      status: apiLatency > 3000 ? 'degraded' : 'operational',
      latency_ms: apiLatency,
    })

    // ── Auth service ───────────────────────────────────────────────────────────
    // Treat as operational if DB is up (auth shares the same Supabase project)
    components.push({
      name: 'Auth',
      status: dbOk ? 'operational' : 'degraded',
      latency_ms: null,
    })

    // ── Recent events ──────────────────────────────────────────────────────────
    const recentEvents: StatusEvent[] = []

    for (const law of recentLawsRes.data ?? []) {
      recentEvents.push({
        type: 'law_established',
        id: law.id,
        label: law.statement,
        category: law.category,
        occurred_at: law.updated_at,
      })
    }
    for (const topic of recentActivatedRes.data ?? []) {
      recentEvents.push({
        type: 'topic_activated',
        id: topic.id,
        label: topic.statement,
        category: topic.category,
        occurred_at: topic.created_at,
      })
    }
    recentEvents.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )

    // ── Overall status ─────────────────────────────────────────────────────────
    const hasOutage = components.some((c) => c.status === 'outage')
    const hasDegraded = components.some((c) => c.status === 'degraded')
    const overall: PlatformStatus['overall'] = hasOutage
      ? 'outage'
      : hasDegraded
      ? 'degraded'
      : 'operational'

    const payload: PlatformStatus = {
      overall,
      checked_at: new Date().toISOString(),
      metrics,
      components,
      recent_events: recentEvents.slice(0, 8),
    }

    const httpStatus = hasOutage ? 503 : 200
    return NextResponse.json(payload, { status: httpStatus, headers: CORS })
  } catch (err) {
    console.error('[/api/status]', err)
    const payload: PlatformStatus = {
      overall: 'outage',
      checked_at: new Date().toISOString(),
      metrics: {
        topics: { total: 0, active: 0, voting: 0, laws: 0, proposed: 0, failed: 0 },
        votes: 0,
        arguments: 0,
        debates: 0,
        coalitions: 0,
        users: 0,
      },
      components: [
        { name: 'Database', status: 'outage', latency_ms: null, message: String(err) },
        { name: 'API', status: 'outage', latency_ms: Date.now() - t0 },
        { name: 'Auth', status: 'outage', latency_ms: null },
      ],
      recent_events: [],
    }
    return NextResponse.json(payload, { status: 503, headers: CORS })
  }
}
