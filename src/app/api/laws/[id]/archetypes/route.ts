import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Archetype metadata ────────────────────────────────────────────────────────

const ARCHETYPE_META: Record<string, { label: string; description: string; icon: string }> = {
  pragmatist: {
    label: 'Pragmatist',
    description: 'Evidence-driven, outcome-focused. Voted on what works, not ideology.',
    icon: '⚖️',
  },
  idealist: {
    label: 'Idealist',
    description: 'Principled and future-oriented. Voted on values and long-term vision.',
    icon: '🌟',
  },
  guardian: {
    label: 'Guardian',
    description: 'Stability-first. Skeptical of rapid change; protects existing institutions.',
    icon: '🛡️',
  },
  reformer: {
    label: 'Reformer',
    description: 'System-challenger. Pushed for structural change and social progress.',
    icon: '🔧',
  },
  libertarian: {
    label: 'Libertarian',
    description: 'Individual-first. Opposes government expansion; champions personal freedom.',
    icon: '🗽',
  },
  communitarian: {
    label: 'Communitarian',
    description: 'Collective-minded. Prioritises community bonds and shared responsibility.',
    icon: '🤝',
  },
  technocrat: {
    label: 'Technocrat',
    description: 'Data-led. Trusts expert analysis and evidence-based policy.',
    icon: '💻',
  },
  democrat: {
    label: 'Democrat',
    description: 'Process-focused. Values participation, transparency, and civic voice.',
    icon: '🗳️',
  },
}

const ORDERED_ARCHETYPES = [
  'pragmatist', 'idealist', 'guardian', 'reformer',
  'libertarian', 'communitarian', 'technocrat', 'democrat',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchetypeBreakdown {
  archetype: string
  label: string
  description: string
  icon: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
  againstPct: number
}

export interface LawArchetypesResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  archetypes: ArchetypeBreakdown[]
  totalWithArchetype: number
  pctWithArchetype: number
  mostForArchetype: string | null
  mostAgainstArchetype: string | null
  mostDividedArchetype: string | null
  viewerArchetype: string | null
  viewerVoteSide: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [lawRes, userRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, topic_id, established_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!lawRes.data) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const law = lawRes.data
  const viewerId = userRes.data.user?.id ?? null

  if (!law.topic_id) {
    return NextResponse.json({
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category ?? null,
        blue_pct: law.blue_pct ?? 50,
        total_votes: law.total_votes ?? 0,
        established_at: law.established_at,
      },
      archetypes: ORDERED_ARCHETYPES.map((arch) => ({
        ...ARCHETYPE_META[arch],
        archetype: arch,
        forVotes: 0,
        againstVotes: 0,
        total: 0,
        forPct: 50,
        againstPct: 50,
      })),
      totalWithArchetype: 0,
      pctWithArchetype: 0,
      mostForArchetype: null,
      mostAgainstArchetype: null,
      mostDividedArchetype: null,
      viewerArchetype: null,
      viewerVoteSide: null,
    } satisfies LawArchetypesResponse)
  }

  // Fetch all votes cast on the original topic
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', law.topic_id)

  // Fetch profiles for all voters to get their archetypes
  const voterIds = (voteRows ?? []).map((v) => v.user_id)

  const profileMap = new Map<string, { civic_archetype: string | null }>()
  if (voterIds.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < voterIds.length; i += CHUNK) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, civic_archetype')
        .in('id', voterIds.slice(i, i + CHUNK))
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { civic_archetype: p.civic_archetype })
      }
    }
  }

  // Count by archetype × side
  const counts: Record<string, { for: number; against: number }> = {}
  for (const arch of ORDERED_ARCHETYPES) {
    counts[arch] = { for: 0, against: 0 }
  }

  let totalWithArchetype = 0

  for (const vote of voteRows ?? []) {
    const profile = profileMap.get(vote.user_id)
    const arch = profile?.civic_archetype
    if (!arch || !counts[arch]) continue
    totalWithArchetype++
    if (vote.side === 'blue') {
      counts[arch].for++
    } else {
      counts[arch].against++
    }
  }

  const archetypes: ArchetypeBreakdown[] = ORDERED_ARCHETYPES.map((arch) => {
    const meta = ARCHETYPE_META[arch]
    const { for: forVotes, against: againstVotes } = counts[arch]
    const total = forVotes + againstVotes
    const forPct = total > 0 ? Math.round((forVotes / total) * 100) : 50
    return {
      archetype: arch,
      label: meta.label,
      description: meta.description,
      icon: meta.icon,
      forVotes,
      againstVotes,
      total,
      forPct,
      againstPct: 100 - forPct,
    }
  })

  const activeArchetypes = archetypes.filter((a) => a.total > 0)

  const mostForArchetype = activeArchetypes.length > 0
    ? activeArchetypes.reduce((best, a) => a.forPct > best.forPct ? a : best).archetype
    : null

  const mostAgainstArchetype = activeArchetypes.length > 0
    ? activeArchetypes.reduce((best, a) => a.againstPct > best.againstPct ? a : best).archetype
    : null

  const mostDividedArchetype = activeArchetypes.length > 0
    ? activeArchetypes.reduce((best, a) => {
        const divA = Math.abs(50 - a.forPct)
        const divB = Math.abs(50 - best.forPct)
        return divA < divB ? a : best
      }).archetype
    : null

  let viewerArchetype: string | null = null
  let viewerVoteSide: string | null = null

  if (viewerId) {
    const viewerProfile = profileMap.get(viewerId)
    viewerArchetype = viewerProfile?.civic_archetype ?? null

    const viewerVote = (voteRows ?? []).find((v) => v.user_id === viewerId)
    if (viewerVote) {
      viewerVoteSide = viewerVote.side === 'blue' ? 'for' : 'against'
    }
  }

  const pctWithArchetype =
    (law.total_votes ?? 0) > 0
      ? Math.round((totalWithArchetype / law.total_votes) * 100)
      : 0

  const response: LawArchetypesResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category ?? null,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    archetypes,
    totalWithArchetype,
    pctWithArchetype,
    mostForArchetype,
    mostAgainstArchetype,
    mostDividedArchetype,
    viewerArchetype,
    viewerVoteSide,
  }

  return NextResponse.json(response)
}
