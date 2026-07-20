import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalystKind = 'argument_surge' | 'high_upvote_arg' | 'status_change' | 'debate_scheduled'

export interface MarketCatalyst {
  id: string
  kind: CatalystKind
  price_impact: number
  price_impact_pct: number
  direction: 'bullish' | 'bearish'
  event_at: string
  // For argument catalysts
  argument_id?: string
  argument_text?: string
  argument_side?: 'blue' | 'red'
  argument_author?: string
  argument_author_avatar?: string | null
  argument_upvotes?: number
  // For status changes
  old_status?: string
  new_status?: string
  // For debate catalysts
  debate_id?: string
}

export interface MarketCatalystsResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  catalysts: MarketCatalyst[]
  summary: {
    total_events: number
    avg_price_impact: number
    biggest_impact: number
    bullish_count: number
    bearish_count: number
  }
  as_of: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') ?? 'all'
    const window = searchParams.get('window') ?? '7d'

    const windowMs =
      window === '24h' ? 24 * 60 * 60 * 1000
      : window === '30d' ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000
    const since = new Date(Date.now() - windowMs).toISOString()

    // Load topic
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .eq('id', params.id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const catalysts: MarketCatalyst[] = []

    // ── 1. High-upvote arguments ──────────────────────────────────────────────
    if (kind === 'all' || kind === 'high_upvote_arg') {
      const { data: topArgs } = await supabase
        .from('topic_arguments')
        .select(`
          id, side, content, created_at, upvotes,
          profiles!topic_arguments_user_id_fkey (username, avatar_url)
        `)
        .eq('topic_id', params.id)
        .gte('created_at', since)
        .gte('upvotes', 3)
        .order('upvotes', { ascending: false })
        .limit(20)

      if (topArgs) {
        for (const arg of topArgs) {
          const profile = arg.profiles as { username: string; avatar_url: string | null } | null

          const { data: snapshots } = await supabase
            .from('topic_price_history')
            .select('price, recorded_at')
            .eq('topic_id', params.id)
            .gte('recorded_at', arg.created_at)
            .lte('recorded_at', new Date(new Date(arg.created_at as string).getTime() + 48 * 60 * 60 * 1000).toISOString())
            .order('recorded_at', { ascending: true })
            .limit(20)

          let impact = 0
          if (snapshots && snapshots.length >= 2) {
            impact = Math.round((snapshots[snapshots.length - 1].price - snapshots[0].price) * 10) / 10
          }

          if (Math.abs(impact) < 0.5) continue

          const openSafe = snapshots && snapshots.length > 0 ? (snapshots[0].price || 50) : 50
          const impactPct = Math.round((impact / openSafe) * 1000) / 10

          catalysts.push({
            id: `arg_${arg.id}`,
            kind: 'high_upvote_arg',
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: impact >= 0 ? 'bullish' : 'bearish',
            event_at: arg.created_at as string,
            argument_id: arg.id,
            argument_text: (arg.content as string).slice(0, 300),
            argument_side: arg.side as 'blue' | 'red',
            argument_author: profile?.username ?? 'Anonymous',
            argument_author_avatar: profile?.avatar_url ?? null,
            argument_upvotes: arg.upvotes as number,
          })
        }
      }
    }

    // ── 2. Argument surge (burst of activity) ─────────────────────────────────
    if (kind === 'all' || kind === 'argument_surge') {
      const { data: priceSnaps } = await supabase
        .from('topic_price_history')
        .select('price, recorded_at')
        .eq('topic_id', params.id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(50)

      if (priceSnaps && priceSnaps.length >= 2) {
        // Find the biggest single-session price swing
        const impact = Math.round((priceSnaps[priceSnaps.length - 1].price - priceSnaps[0].price) * 10) / 10
        if (Math.abs(impact) >= 2) {
          const impactPct = Math.round((impact / (priceSnaps[0].price || 50)) * 1000) / 10
          catalysts.push({
            id: `surge_${params.id}_${window}`,
            kind: 'argument_surge',
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: impact >= 0 ? 'bullish' : 'bearish',
            event_at: since,
          })
        }
      }
    }

    // ── 3. Status change ──────────────────────────────────────────────────────
    if (kind === 'all' || kind === 'status_change') {
      const { data: topicHistory } = await supabase
        .from('topics')
        .select('status, updated_at, blue_pct')
        .eq('id', params.id)
        .maybeSingle()

      if (topicHistory && topicHistory.updated_at >= since) {
        const inVotingOrSettled = ['voting', 'law', 'failed'].includes(topicHistory.status)
        if (inVotingOrSettled) {
          const oldStatus =
            topicHistory.status === 'voting' ? 'active'
            : topicHistory.status === 'law' ? 'voting'
            : 'voting'

          const settlementPrice =
            topicHistory.status === 'law' ? 100
            : topicHistory.status === 'failed' ? 0
            : null

          const impact = settlementPrice !== null
            ? Math.round(settlementPrice - (topicHistory.blue_pct ?? 50))
            : 10

          if (Math.abs(impact) >= 1) {
            const impactPct = Math.round((impact / (topicHistory.blue_pct || 50)) * 1000) / 10
            catalysts.push({
              id: `status_${params.id}`,
              kind: 'status_change',
              price_impact: impact,
              price_impact_pct: impactPct,
              direction: impact >= 0 ? 'bullish' : 'bearish',
              event_at: topicHistory.updated_at as string,
              old_status: oldStatus,
              new_status: topicHistory.status,
            })
          }
        }
      }
    }

    // ── 4. Debate events ──────────────────────────────────────────────────────
    if (kind === 'all' || kind === 'debate_scheduled') {
      const { data: debates } = await supabase
        .from('debates')
        .select('id, scheduled_at')
        .eq('topic_id', params.id)
        .gte('scheduled_at', since)
        .order('scheduled_at', { ascending: false })
        .limit(10)

      if (debates) {
        for (const debate of debates) {
          const { data: priceSnaps } = await supabase
            .from('topic_price_history')
            .select('price, recorded_at')
            .eq('topic_id', params.id)
            .gte('recorded_at', debate.scheduled_at as string)
            .order('recorded_at', { ascending: true })
            .limit(5)

          const impact =
            priceSnaps && priceSnaps.length >= 2
              ? Math.round((priceSnaps[priceSnaps.length - 1].price - priceSnaps[0].price) * 10) / 10
              : 0
          const impactPct =
            priceSnaps && priceSnaps.length >= 2
              ? Math.round((impact / (priceSnaps[0].price || 50)) * 1000) / 10
              : 0

          catalysts.push({
            id: `debate_${debate.id}`,
            kind: 'debate_scheduled',
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: impact >= 0 ? 'bullish' : 'bearish',
            event_at: debate.scheduled_at as string,
            debate_id: debate.id,
          })
        }
      }
    }

    // ── Sort and summarize ────────────────────────────────────────────────────
    catalysts.sort((a, b) => Math.abs(b.price_impact) - Math.abs(a.price_impact))
    const topN = catalysts.slice(0, 30)

    const totalImpact = topN.reduce((sum, c) => sum + Math.abs(c.price_impact), 0)
    const avgImpact = topN.length > 0 ? Math.round((totalImpact / topN.length) * 10) / 10 : 0
    const biggest = topN[0] ?? null
    const bullishCount = topN.filter(c => c.direction === 'bullish').length
    const bearishCount = topN.filter(c => c.direction === 'bearish').length

    return NextResponse.json({
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: Math.round(topic.blue_pct ?? 50),
      catalysts: topN,
      summary: {
        total_events: topN.length,
        avg_price_impact: avgImpact,
        biggest_impact: biggest ? Math.abs(biggest.price_impact) : 0,
        bullish_count: bullishCount,
        bearish_count: bearishCount,
      },
      as_of: new Date().toISOString(),
    } satisfies MarketCatalystsResponse)
  } catch (err) {
    console.error('[exchange/[id]/catalysts]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
