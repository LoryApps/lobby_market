import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OppositionArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvotes: number
  reply_count: number
  created_at: string
  author: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    clout: number
  } | null
  rhetorical_type: 'evidence' | 'moral' | 'economic' | 'practical' | 'precedent'
  bite: string // 1-sentence summary
}

export interface OppositionVoice {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  clout: number
  argument_count: number
  total_upvotes: number
  top_argument: string
}

export interface ObjectionCategory {
  label: string
  description: string
  count: number
  share: number          // 0-100
  color: 'against' | 'gold' | 'emerald' | 'purple'
  example_argument: string
}

export interface ChangemindCondition {
  id: string
  condition: string
  upvotes: number
  voter_side: 'for' | 'against'
}

export interface OppositionResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  // Strongest arguments from the minority side (the side with < 50%)
  // If tied, show AGAINST
  minority_side: 'for' | 'against'
  majority_side: 'for' | 'against'
  minority_pct: number
  majority_pct: number
  top_arguments: OppositionArgument[]
  top_voices: OppositionVoice[]
  objection_categories: ObjectionCategory[]
  change_conditions: ChangemindCondition[]   // what would flip minority voters
  total_minority_arguments: number
}

// ─── Rhetorical type inference ──────────────────────────────────────────────

function inferRhetoricalType(body: string): OppositionArgument['rhetorical_type'] {
  const b = body.toLowerCase()
  if (/study|data|research|evidence|statistic|report|survey|proven|measured/i.test(b)) return 'evidence'
  if (/moral|right|wrong|ethical|justice|fair|dignity|rights|freedom|liberty/i.test(b)) return 'moral'
  if (/cost|econom|money|budget|tax|fund|spend|afford|price|fiscal|gdp|invest/i.test(b)) return 'economic'
  if (/implement|enforce|practical|realistic|feasible|work|administr/i.test(b)) return 'practical'
  if (/history|precedent|before|tried|failed|worked|example|case|country|nation/i.test(b)) return 'precedent'
  return 'practical'
}

function bite(body: string, n = 120): string {
  const s = body.trim()
  const period = s.indexOf('.')
  if (period > 0 && period <= n) return s.slice(0, period + 1)
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…'
}

// ─── Route ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const forPct   = Math.round(topic.blue_pct ?? 50)
  const againPct = 100 - forPct

  // "minority" = smaller side; used as the "opposition" perspective
  const minority_side: 'for' | 'against' = forPct <= againPct ? 'for' : 'against'
  const majority_side: 'for' | 'against' = minority_side === 'for' ? 'against' : 'for'
  const minority_pct = minority_side === 'for' ? forPct : againPct
  const majority_pct = 100 - minority_pct

  // 2. Top arguments from the minority side
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id,
      body,
      side,
      upvotes,
      reply_count,
      created_at,
      author_id,
      profiles!arguments_author_id_fkey (
        id, username, display_name, avatar_url, clout
      )
    `)
    .eq('topic_id', params.id)
    .eq('side', minority_side)
    .order('upvotes', { ascending: false })
    .limit(20)

  const top_arguments: OppositionArgument[] = (rawArgs ?? []).map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (a as any).profiles as {
      id: string
      username: string | null
      display_name: string | null
      avatar_url: string | null
      clout: number | null
    } | null

    return {
      id:      a.id,
      body:    a.body,
      side:    a.side as 'for' | 'against',
      upvotes: a.upvotes ?? 0,
      reply_count: (a as { reply_count?: number }).reply_count ?? 0,
      created_at:  a.created_at,
      author: p ? {
        id:           p.id,
        username:     p.username,
        display_name: p.display_name,
        avatar_url:   p.avatar_url,
        clout:        p.clout ?? 0,
      } : null,
      rhetorical_type: inferRhetoricalType(a.body),
      bite:            bite(a.body),
    }
  })

  // 3. Total minority argument count
  const { count: total_minority_arguments } = await supabase
    .from('arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)
    .eq('side', minority_side)

  // 4. Top voices — users who contributed the most to the minority side
  const voiceMap = new Map<string, {
    profile: NonNullable<OppositionArgument['author']>
    args: OppositionArgument[]
  }>()

  for (const arg of top_arguments) {
    if (!arg.author) continue
    const entry = voiceMap.get(arg.author.id)
    if (entry) {
      entry.args.push(arg)
    } else {
      voiceMap.set(arg.author.id, { profile: arg.author, args: [arg] })
    }
  }

  const top_voices: OppositionVoice[] = [...voiceMap.values()]
    .map(({ profile, args }) => ({
      id:             profile.id,
      username:       profile.username,
      display_name:   profile.display_name,
      avatar_url:     profile.avatar_url,
      clout:          profile.clout,
      argument_count: args.length,
      total_upvotes:  args.reduce((s, a) => s + a.upvotes, 0),
      top_argument:   bite(args[0]?.body ?? '', 140),
    }))
    .sort((a, b) => b.total_upvotes - a.total_upvotes)
    .slice(0, 6)

  // 5. Objection categories — derived from rhetorical type breakdown
  const typeCounts: Record<string, number> = {}
  for (const arg of top_arguments) {
    typeCounts[arg.rhetorical_type] = (typeCounts[arg.rhetorical_type] ?? 0) + 1
  }
  const total = top_arguments.length || 1

  const TYPE_META: Record<string, { label: string; description: string; color: ObjectionCategory['color'] }> = {
    evidence:  { label: 'Empirical',  description: 'Grounded in data, research, and measurable outcomes', color: 'emerald' },
    moral:     { label: 'Moral',      description: 'Rooted in ethics, rights, justice, and values',        color: 'purple' },
    economic:  { label: 'Economic',   description: 'Focused on costs, efficiency, and fiscal impact',      color: 'gold' },
    practical: { label: 'Practical',  description: 'Questions about implementation and real-world effect', color: 'against' },
    precedent: { label: 'Historical', description: 'Draws on precedent, historical parallels, and cases',  color: 'gold' },
  }

  const exampleByType: Record<string, string> = {}
  for (const arg of top_arguments) {
    if (!exampleByType[arg.rhetorical_type]) {
      exampleByType[arg.rhetorical_type] = arg.bite
    }
  }

  const objection_categories: ObjectionCategory[] = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label:            TYPE_META[type]?.label ?? type,
      description:      TYPE_META[type]?.description ?? '',
      count,
      share:            Math.round((count / total) * 100),
      color:            TYPE_META[type]?.color ?? 'against',
      example_argument: exampleByType[type] ?? '',
    }))

  // 6. What would change minority voters' minds
  const { data: rawConditions } = await supabase
    .from('topic_changemakers')
    .select('id, condition, upvotes, current_vote')
    .eq('topic_id', params.id)
    .eq('current_vote', minority_side)
    .order('upvotes', { ascending: false })
    .limit(6)

  const change_conditions: ChangemindCondition[] = (rawConditions ?? []).map((c) => ({
    id:         c.id,
    condition:  c.condition,
    upvotes:    c.upvotes ?? 0,
    voter_side: c.current_vote as 'for' | 'against',
  }))

  const resp: OppositionResponse = {
    topic: {
      id:          topic.id,
      statement:   topic.statement,
      category:    topic.category,
      status:      topic.status,
      blue_pct:    forPct,
      total_votes: topic.total_votes ?? 0,
    },
    minority_side,
    majority_side,
    minority_pct,
    majority_pct,
    top_arguments:          top_arguments.slice(0, 10),
    top_voices,
    objection_categories,
    change_conditions,
    total_minority_arguments: total_minority_arguments ?? 0,
  }

  return NextResponse.json(resp)
}
