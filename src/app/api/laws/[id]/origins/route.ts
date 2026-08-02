import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OriginFoundingArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  reply_count: number
  created_at: string
  author_id: string | null
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  author_clout: number
  is_first_for: boolean
  is_first_against: boolean
}

export interface OriginPioneerVoter {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  clout: number
  side: 'for' | 'against'
  voted_at: string
  rank: number
}

export interface LawJourneyPhase {
  phase: 'proposed' | 'active' | 'voting' | 'established'
  date: string
  label: string
  duration_days: number | null
}

export interface LawOriginsResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    days_to_pass: number
    topic_id: string
  }
  founder: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    clout: number
    role: string
    total_laws_founded: number
  } | null
  journey: LawJourneyPhase[]
  founding_arguments: OriginFoundingArgument[]
  pioneer_voters: OriginPioneerVoter[]
  first_week_stats: {
    arguments_in_week: number
    votes_in_week: number
    for_in_week: number
    against_in_week: number
    top_early_argument: string | null
  }
  total_pioneers: number
}

// ─── GET /api/laws/[id]/origins ───────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  // ── 1. Fetch law + parent topic ───────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select(`
      id, topic_id, statement, category,
      blue_pct, total_votes, established_at
    `)
    .eq('id', lawId)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('id, created_at, user_id, status, support_count, activation_threshold')
    .eq('id', law.topic_id)
    .maybeSingle()

  const topicCreatedAt = topic?.created_at ? new Date(topic.created_at) : new Date(law.established_at)
  const establishedAt = new Date(law.established_at)
  const daysToPass = Math.max(1, Math.floor(
    (establishedAt.getTime() - topicCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  ))

  // ── 2. Founder profile ────────────────────────────────────────────────────
  let founder: LawOriginsResponse['founder'] = null
  if (topic?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, role')
      .eq('id', topic.user_id)
      .maybeSingle()

    if (profile) {
      // Count topics proposed by this user that became laws
      const { data: founderTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('user_id', topic.user_id)
        .eq('status', 'law')

      const founderTopicIds = (founderTopics ?? []).map(t => t.id)
      let lawsCount = 0
      if (founderTopicIds.length > 0) {
        const { count } = await supabase
          .from('laws')
          .select('id', { count: 'exact', head: true })
          .in('topic_id', founderTopicIds)
        lawsCount = count ?? 0
      }

      founder = {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        clout: profile.clout ?? 0,
        role: profile.role ?? 'person',
        total_laws_founded: lawsCount,
      }
    }
  }

  // ── 3. Journey phases (derived from proposal → establishment dates) ─────────
  const journey: LawJourneyPhase[] = []
  const proposedDate = topic?.created_at ?? law.established_at

  journey.push({
    phase: 'proposed',
    date: proposedDate,
    label: 'Proposed',
    duration_days: null,
  })

  // Synthetic phase split: proposal → active → voting → established
  if (daysToPass > 3) {
    const third = Math.floor(daysToPass / 3)
    const activeDate = new Date(topicCreatedAt.getTime() + third * 24 * 60 * 60 * 1000)
    const votingDate = new Date(topicCreatedAt.getTime() + (2 * third) * 24 * 60 * 60 * 1000)
    journey.push({ phase: 'active', date: activeDate.toISOString(), label: 'Became Active', duration_days: third })
    journey.push({ phase: 'voting', date: votingDate.toISOString(), label: 'Entered Final Vote', duration_days: third })
    const lastPhase = journey[journey.length - 1]
    const finalDur = Math.max(0, Math.floor(
      (establishedAt.getTime() - new Date(lastPhase.date).getTime()) / (1000 * 60 * 60 * 24)
    ))
    journey.push({
      phase: 'established',
      date: law.established_at,
      label: 'Established as Law',
      duration_days: finalDur,
    })
  } else {
    journey.push({
      phase: 'established',
      date: law.established_at,
      label: 'Established as Law',
      duration_days: daysToPass,
    })
  }

  // ── 4. Founding arguments ─────────────────────────────────────────────────
  const { data: allArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, reply_count, created_at, user_id
    `)
    .eq('topic_id', law.topic_id)
    .order('created_at', { ascending: true })
    .limit(100)

  const args = allArgs ?? []
  const firstForIdx = args.findIndex(a => a.side === 'blue')
  const firstAgainstIdx = args.findIndex(a => a.side === 'red')

  // Top 6 by upvotes, but always include first FOR and first AGAINST
  const byUpvotes = [...args].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
  const topByUpvotes = byUpvotes.slice(0, 8)
  const featured = new Set<string>()
  const foundingArgs: typeof args = []

  // Prioritize first FOR and first AGAINST
  if (firstForIdx !== -1) {
    foundingArgs.push(args[firstForIdx])
    featured.add(args[firstForIdx].id)
  }
  if (firstAgainstIdx !== -1 && !featured.has(args[firstAgainstIdx].id)) {
    foundingArgs.push(args[firstAgainstIdx])
    featured.add(args[firstAgainstIdx].id)
  }
  for (const a of topByUpvotes) {
    if (!featured.has(a.id) && foundingArgs.length < 6) {
      foundingArgs.push(a)
      featured.add(a.id)
    }
  }

  // Enrich with author profiles
  const argUserIds = [...new Set(foundingArgs.map(a => a.user_id).filter(Boolean))] as string[]
  const { data: argProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout')
    .in('id', argUserIds)

  const argProfileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null; clout: number }>()
  for (const p of argProfiles ?? []) {
    argProfileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, clout: p.clout ?? 0 })
  }

  const founding_arguments: OriginFoundingArgument[] = foundingArgs.map(a => {
    const ap = a.user_id ? argProfileMap.get(a.user_id) : null
    return {
      id: a.id,
      content: a.content,
      side: a.side === 'blue' ? 'for' : 'against',
      upvotes: a.upvotes ?? 0,
      reply_count: a.reply_count ?? 0,
      created_at: a.created_at,
      author_id: a.user_id ?? null,
      author_username: ap?.username ?? null,
      author_display_name: ap?.display_name ?? null,
      author_avatar_url: ap?.avatar_url ?? null,
      author_clout: ap?.clout ?? 0,
      is_first_for: firstForIdx !== -1 && a.id === args[firstForIdx].id,
      is_first_against: firstAgainstIdx !== -1 && a.id === args[firstAgainstIdx].id,
    }
  })

  // ── 5. Pioneer voters ─────────────────────────────────────────────────────
  const { data: earlyVotes } = await supabase
    .from('votes')
    .select('user_id, side, created_at')
    .eq('topic_id', law.topic_id)
    .order('created_at', { ascending: true })
    .limit(20)

  let pioneer_voters: OriginPioneerVoter[] = []
  if (earlyVotes && earlyVotes.length > 0) {
    const voteUserIds = earlyVotes.map(v => v.user_id)
    const { data: voteProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout')
      .in('id', voteUserIds)

    const voteProfileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null; clout: number }>()
    for (const p of voteProfiles ?? []) {
      voteProfileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, clout: p.clout ?? 0 })
    }

    pioneer_voters = earlyVotes.map((v, i) => {
      const vp = voteProfileMap.get(v.user_id) ?? { username: null, display_name: null, avatar_url: null, clout: 0 }
      return {
        user_id: v.user_id,
        username: vp.username,
        display_name: vp.display_name,
        avatar_url: vp.avatar_url,
        clout: vp.clout,
        side: v.side === 'blue' ? 'for' : 'against',
        voted_at: v.created_at,
        rank: i + 1,
      }
    })
  }

  // ── 6. First-week stats ───────────────────────────────────────────────────
  const oneWeekAfter = new Date(topicCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  const weekArgCount = args.filter(a => new Date(a.created_at) <= oneWeekAfter).length
  const { data: weekVotes } = await supabase
    .from('votes')
    .select('side')
    .eq('topic_id', law.topic_id)
    .lte('created_at', oneWeekAfter.toISOString())

  const weekVoteCount = weekVotes?.length ?? 0
  const weekForCount = weekVotes?.filter(v => v.side === 'blue').length ?? 0

  const topEarlyArg = args
    .filter(a => new Date(a.created_at) <= oneWeekAfter)
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))[0]

  const response: LawOriginsResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      days_to_pass: daysToPass,
      topic_id: law.topic_id,
    },
    founder,
    journey,
    founding_arguments,
    pioneer_voters,
    first_week_stats: {
      arguments_in_week: weekArgCount,
      votes_in_week: weekVoteCount,
      for_in_week: weekForCount,
      against_in_week: weekVoteCount - weekForCount,
      top_early_argument: topEarlyArg?.content?.slice(0, 200) ?? null,
    },
    total_pioneers: earlyVotes?.length ?? 0,
  }

  return NextResponse.json(response)
}
