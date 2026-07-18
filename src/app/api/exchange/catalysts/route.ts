import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalystKind = 'argument_surge' | 'high_upvote_arg' | 'status_change' | 'debate_scheduled'

export interface Catalyst {
  id: string
  kind: CatalystKind
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  price_impact: number       // ¢ moved within 48h of event
  price_impact_pct: number   // % change
  direction: 'bullish' | 'bearish'
  event_at: string
  // For argument catalysts
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

export interface CatalystsResponse {
  catalysts: Catalyst[]
  summary: {
    total_events: number
    avg_price_impact: number
    biggest_mover_id: string | null
    biggest_mover_impact: number
  }
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceMoveLabel(impact: number): 'bullish' | 'bearish' {
  return impact >= 0 ? 'bullish' : 'bearish'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') ?? 'all'
    const window = searchParams.get('window') ?? '7d'

    const windowMs = window === '24h' ? 24 * 60 * 60 * 1000
      : window === '30d' ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000
    const since = new Date(Date.now() - windowMs).toISOString()

    const catalysts: Catalyst[] = []

    // ── 1. High-upvote argument catalysts ────────────────────────────────────
    // Arguments with many upvotes that preceded a measurable price move
    if (kind === 'all' || kind === 'high_upvote_arg') {
      const { data: topArgs } = await supabase
        .from('topic_arguments')
        .select(`
          id, topic_id, side, content, created_at,
          upvotes,
          profiles!topic_arguments_user_id_fkey (username, avatar_url),
          topics!topic_arguments_topic_id_fkey (
            statement, category, status, blue_pct, total_votes
          )
        `)
        .gte('created_at', since)
        .gte('upvotes', 5)
        .order('upvotes', { ascending: false })
        .limit(30)

      if (topArgs) {
        for (const arg of topArgs) {
          const topic = arg.topics as {
            statement: string
            category: string | null
            status: string
            blue_pct: number
            total_votes: number
          } | null
          if (!topic) continue

          const profile = arg.profiles as {
            username: string
            avatar_url: string | null
          } | null

          // Estimate price impact: look at price snapshots around this argument
          const { data: snapshots } = await supabase
            .from('topic_price_history')
            .select('price, recorded_at')
            .eq('topic_id', arg.topic_id)
            .gte('recorded_at', arg.created_at)
            .lte('recorded_at', new Date(new Date(arg.created_at).getTime() + 48 * 60 * 60 * 1000).toISOString())
            .order('recorded_at', { ascending: true })
            .limit(20)

          let impact = 0
          if (snapshots && snapshots.length >= 2) {
            impact = Math.round((snapshots[snapshots.length - 1].price - snapshots[0].price) * 10) / 10
          } else if (snapshots && snapshots.length === 1) {
            // Compare to current
            impact = Math.round((topic.blue_pct - snapshots[0].price) * 10) / 10
          }

          // Only surface if there was measurable movement
          const absImpact = Math.abs(impact)
          if (absImpact < 1) continue

          const openSafe = snapshots && snapshots.length > 0 ? (snapshots[0].price || 50) : 50
          const impactPct = Math.round((impact / openSafe) * 1000) / 10

          catalysts.push({
            id: `arg_${arg.id}`,
            kind: 'high_upvote_arg',
            topic_id: arg.topic_id,
            statement: topic.statement,
            category: topic.category,
            status: topic.status,
            current_price: Math.round(topic.blue_pct),
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: priceMoveLabel(impact),
            event_at: arg.created_at as string,
            argument_text: (arg.content as string).slice(0, 200),
            argument_side: arg.side as 'blue' | 'red',
            argument_author: profile?.username ?? 'Anonymous',
            argument_author_avatar: profile?.avatar_url ?? null,
            argument_upvotes: arg.upvotes as number,
          })
        }
      }
    }

    // ── 2. Argument surge catalysts ───────────────────────────────────────────
    // Topics that saw many arguments in a short window and then had price moves
    if (kind === 'all' || kind === 'argument_surge') {
      const { data: surgeTopics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('status', ['active', 'voting', 'law', 'failed'])
        .gte('total_votes', 20)
        .order('total_votes', { ascending: false })
        .limit(50)

      if (surgeTopics) {
        for (const topic of surgeTopics.slice(0, 20)) {
          // Find recent argument surges
          const surgeStart = new Date(Date.now() - windowMs).toISOString()
          const { data: argCount } = await supabase
            .from('topic_arguments')
            .select('id, created_at', { count: 'exact', head: false })
            .eq('topic_id', topic.id)
            .gte('created_at', surgeStart)
            .limit(1)

          if (!argCount || argCount.length < 5) continue

          // Check if price moved after arguments started
          const { data: priceSnaps } = await supabase
            .from('topic_price_history')
            .select('price, recorded_at')
            .eq('topic_id', topic.id)
            .gte('recorded_at', surgeStart)
            .order('recorded_at', { ascending: true })
            .limit(10)

          if (!priceSnaps || priceSnaps.length < 2) continue

          const impact = Math.round((priceSnaps[priceSnaps.length - 1].price - priceSnaps[0].price) * 10) / 10
          if (Math.abs(impact) < 2) continue

          const impactPct = Math.round((impact / (priceSnaps[0].price || 50)) * 1000) / 10

          catalysts.push({
            id: `surge_${topic.id}`,
            kind: 'argument_surge',
            topic_id: topic.id,
            statement: topic.statement,
            category: topic.category,
            status: topic.status,
            current_price: Math.round(topic.blue_pct),
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: priceMoveLabel(impact),
            event_at: surgeStart,
          })
        }
      }
    }

    // ── 3. Status change catalysts ─────────────────────────────────────────────
    // Topics that recently changed status — always big price moves
    if (kind === 'all' || kind === 'status_change') {
      const { data: statusChanges } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at, created_at')
        .gte('updated_at', since)
        .in('status', ['voting', 'law', 'failed'])
        .order('updated_at', { ascending: false })
        .limit(20)

      if (statusChanges) {
        for (const topic of statusChanges) {
          const oldStatus =
            topic.status === 'voting' ? 'active'
            : topic.status === 'law' ? 'voting'
            : 'voting'

          const settlementPrice =
            topic.status === 'law' ? 100
            : topic.status === 'failed' ? 0
            : null

          const impact = settlementPrice !== null
            ? Math.round(settlementPrice - topic.blue_pct)
            : topic.status === 'voting' ? 10 : 0

          if (Math.abs(impact) < 1) continue

          const impactPct = Math.round((impact / (topic.blue_pct || 50)) * 1000) / 10

          catalysts.push({
            id: `status_${topic.id}`,
            kind: 'status_change',
            topic_id: topic.id,
            statement: topic.statement,
            category: topic.category,
            status: topic.status,
            current_price: Math.round(topic.blue_pct),
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: priceMoveLabel(impact),
            event_at: topic.updated_at as string,
            old_status: oldStatus,
            new_status: topic.status,
          })
        }
      }
    }

    // ── 4. Debate catalysts ────────────────────────────────────────────────────
    if (kind === 'all' || kind === 'debate_scheduled') {
      const { data: debates } = await supabase
        .from('debates')
        .select(`
          id, topic_id, scheduled_at,
          topics!debates_topic_id_fkey (
            statement, category, status, blue_pct, total_votes
          )
        `)
        .gte('scheduled_at', since)
        .order('scheduled_at', { ascending: false })
        .limit(20)

      if (debates) {
        for (const debate of debates) {
          const topic = debate.topics as {
            statement: string
            category: string | null
            status: string
            blue_pct: number
            total_votes: number
          } | null
          if (!topic) continue

          // Check price change after debate was scheduled
          const { data: priceSnaps } = await supabase
            .from('topic_price_history')
            .select('price, recorded_at')
            .eq('topic_id', debate.topic_id)
            .gte('recorded_at', debate.scheduled_at as string)
            .order('recorded_at', { ascending: true })
            .limit(5)

          if (!priceSnaps || priceSnaps.length < 2) {
            // Include debates with expected impact even without data
            catalysts.push({
              id: `debate_${debate.id}`,
              kind: 'debate_scheduled',
              topic_id: debate.topic_id,
              statement: topic.statement,
              category: topic.category,
              status: topic.status,
              current_price: Math.round(topic.blue_pct),
              price_impact: 0,
              price_impact_pct: 0,
              direction: 'bullish',
              event_at: debate.scheduled_at as string,
              debate_id: debate.id,
            })
            continue
          }

          const impact = Math.round((priceSnaps[priceSnaps.length - 1].price - priceSnaps[0].price) * 10) / 10
          const impactPct = Math.round((impact / (priceSnaps[0].price || 50)) * 1000) / 10

          catalysts.push({
            id: `debate_${debate.id}`,
            kind: 'debate_scheduled',
            topic_id: debate.topic_id,
            statement: topic.statement,
            category: topic.category,
            status: topic.status,
            current_price: Math.round(topic.blue_pct),
            price_impact: impact,
            price_impact_pct: impactPct,
            direction: priceMoveLabel(impact),
            event_at: debate.scheduled_at as string,
            debate_id: debate.id,
          })
        }
      }
    }

    // ── Sort by absolute price impact descending ──────────────────────────────
    catalysts.sort((a, b) => Math.abs(b.price_impact) - Math.abs(a.price_impact))

    const topN = catalysts.slice(0, 40)

    const totalImpact = topN.reduce((sum, c) => sum + Math.abs(c.price_impact), 0)
    const avgImpact = topN.length > 0 ? Math.round((totalImpact / topN.length) * 10) / 10 : 0
    const biggest = topN[0] ?? null

    return NextResponse.json({
      catalysts: topN,
      summary: {
        total_events: topN.length,
        avg_price_impact: avgImpact,
        biggest_mover_id: biggest?.topic_id ?? null,
        biggest_mover_impact: biggest ? Math.abs(biggest.price_impact) : 0,
      },
      as_of: new Date().toISOString(),
    } satisfies CatalystsResponse)
  } catch (err) {
    console.error('[exchange/catalysts]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
