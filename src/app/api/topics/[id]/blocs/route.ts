import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoleBloc {
  role: string
  label: string
  total: number
  for: number
  against: number
  for_pct: number
}

export interface CloutBloc {
  tier: string
  label: string
  total: number
  for: number
  against: number
  for_pct: number
}

export interface CoalitionStance {
  coalition_id: string
  name: string
  tag: string | null
  member_count: number
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
}

export interface ArguerSplit {
  arguers_for: number
  arguers_against: number
  arguers_total: number
  non_arguers_for_pct: number
  arguers_for_pct: number
}

export interface TopicBlocsResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  by_role: RoleBloc[]
  by_clout: CloutBloc[]
  coalitions: CoalitionStance[]
  arguer_split: ArguerSplit | null
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debater',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  lawmaker:      'Lawmaker',
}

const CLOUT_TIERS = [
  { tier: 'newcomer',  label: 'Newcomers',  min: 0,    max: 99 },
  { tier: 'engaged',   label: 'Engaged',    min: 100,  max: 499 },
  { tier: 'veteran',   label: 'Veterans',   min: 500,  max: 1999 },
  { tier: 'prominent', label: 'Prominent',  min: 2000, max: 9999 },
  { tier: 'elite',     label: 'Elite',      min: 10000, max: null },
]

// ─── GET /api/topics/[id]/blocs ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const topicId = params.id

    // 1. Fetch topic metadata
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', topicId)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // 2. Fetch all votes for this topic with profile data
    const PAGE = 1000
    let allVotes: Array<{ side: string; profiles: { role: string; clout: number } | null }> = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch } = await supabase
        .from('votes')
        .select('side, profiles!inner(role, clout)')
        .eq('topic_id', topicId)
        .range(from, from + PAGE - 1)

      if (!batch || batch.length === 0) {
        hasMore = false
      } else {
        allVotes = allVotes.concat(batch as typeof allVotes)
        if (batch.length < PAGE) hasMore = false
        from += PAGE
        if (allVotes.length >= 10000) hasMore = false
      }
    }

    // 3. Role breakdown
    const roleBuckets: Record<string, { for: number; against: number }> = {}
    for (const v of allVotes) {
      const role = v.profiles?.role ?? 'person'
      if (!roleBuckets[role]) roleBuckets[role] = { for: 0, against: 0 }
      if (v.side === 'blue') roleBuckets[role].for++
      else roleBuckets[role].against++
    }

    const ROLE_ORDER = ['lawmaker', 'elder', 'troll_catcher', 'debator', 'person']
    const by_role: RoleBloc[] = ROLE_ORDER
      .filter((r) => roleBuckets[r])
      .map((role) => {
        const b = roleBuckets[role]
        const total = b.for + b.against
        return {
          role,
          label: ROLE_LABELS[role] ?? role,
          total,
          for: b.for,
          against: b.against,
          for_pct: total > 0 ? Math.round((b.for / total) * 100) : 50,
        }
      })

    // 4. Clout tier breakdown
    const cloutBuckets: Record<string, { for: number; against: number }> = {}
    for (const v of allVotes) {
      const clout = v.profiles?.clout ?? 0
      const tier = CLOUT_TIERS.find(
        (t) => clout >= t.min && (t.max === null || clout <= t.max)
      )?.tier ?? 'newcomer'
      if (!cloutBuckets[tier]) cloutBuckets[tier] = { for: 0, against: 0 }
      if (v.side === 'blue') cloutBuckets[tier].for++
      else cloutBuckets[tier].against++
    }

    const by_clout: CloutBloc[] = CLOUT_TIERS
      .filter((t) => cloutBuckets[t.tier])
      .map((t) => {
        const b = cloutBuckets[t.tier]
        const total = b.for + b.against
        return {
          tier: t.tier,
          label: t.label,
          total,
          for: b.for,
          against: b.against,
          for_pct: total > 0 ? Math.round((b.for / total) * 100) : 50,
        }
      })

    // 5. Coalition stances
    const { data: stances } = await supabase
      .from('coalition_stances')
      .select('stance, statement, coalition_id, coalitions!inner(name, tag, member_count, is_public)')
      .eq('topic_id', topicId)
      .eq('coalitions.is_public', true)
      .order('coalition_id')
      .limit(20)

    const coalitions: CoalitionStance[] = (stances ?? []).map((s) => ({
      coalition_id: s.coalition_id,
      name: (s.coalitions as { name: string; tag: string | null; member_count: number }).name,
      tag: (s.coalitions as { name: string; tag: string | null; member_count: number }).tag,
      member_count: (s.coalitions as { name: string; tag: string | null; member_count: number }).member_count ?? 0,
      stance: s.stance as 'for' | 'against' | 'neutral',
      statement: s.statement ?? null,
    }))

    // 6. Arguer vs non-arguer split
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('user_id')
      .eq('topic_id', topicId)

    let arguer_split: ArguerSplit | null = null

    if (argRows && argRows.length > 0) {
      const arguerSet = new Set(argRows.map((a) => a.user_id))

      const { data: votesWithUser } = await supabase
        .from('votes')
        .select('side, user_id')
        .eq('topic_id', topicId)
        .limit(5000)

      if (votesWithUser) {
        let arguersFor = 0, arguersAgainst = 0
        let nonArguersFor = 0, nonArguersAgainst = 0

        for (const v of votesWithUser) {
          const isArguer = arguerSet.has(v.user_id)
          if (isArguer) {
            if (v.side === 'blue') arguersFor++
            else arguersAgainst++
          } else {
            if (v.side === 'blue') nonArguersFor++
            else nonArguersAgainst++
          }
        }

        const arguersTotal = arguersFor + arguersAgainst
        const nonArguersTotal = nonArguersFor + nonArguersAgainst

        arguer_split = {
          arguers_for: arguersFor,
          arguers_against: arguersAgainst,
          arguers_total: arguersTotal,
          non_arguers_for_pct: nonArguersTotal > 0
            ? Math.round((nonArguersFor / nonArguersTotal) * 100)
            : 50,
          arguers_for_pct: arguersTotal > 0
            ? Math.round((arguersFor / arguersTotal) * 100)
            : 50,
        }
      }
    }

    const response: TopicBlocsResponse = {
      topic_id: topicId,
      statement: topic.statement ?? '',
      category: topic.category ?? null,
      status: topic.status ?? 'active',
      total_votes: topic.total_votes ?? 0,
      blue_pct: topic.blue_pct ?? 50,
      by_role,
      by_clout,
      coalitions,
      arguer_split,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[topic-blocs]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
