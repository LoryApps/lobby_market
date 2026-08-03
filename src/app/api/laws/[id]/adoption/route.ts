import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdoptionSignal {
  label: string
  value: number
  trend: 'up' | 'down' | 'flat'
  description: string
}

export interface AdoptionEvent {
  type: 'challenge' | 'amendment' | 'revision' | 'wiki_edit' | 'debate'
  title: string
  date: string
  status?: string
  link?: string
}

export interface LawAdoptionData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string | null
    topic_id: string
  }
  /** 0–100 composite adoption health score */
  adoptionScore: number
  adoptionLabel: 'Thriving' | 'Stable' | 'Active' | 'Pressured' | 'At Risk'
  signals: AdoptionSignal[]
  /** Timeline of post-passage events */
  timeline: AdoptionEvent[]
  stats: {
    daysSincePassage: number
    challengeCount: number
    openChallenges: number
    amendmentCount: number
    ratifiedAmendments: number
    pendingAmendments: number
    wikiRevisions: number
    debatesCount: number
    reviewCount: number
    avgStars: number | null
  }
  /** Friction breakdown */
  friction: {
    challengeFriction: number   // 0–100
    amendmentPressure: number   // 0–100
    overallFriction: number     // 0–100
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeAdoptionScore(
  daysSincePassage: number,
  openChallenges: number,
  totalChallenges: number,
  pendingAmendments: number,
  ratifiedAmendments: number,
  wikiRevisions: number,
  bluePct: number,
): number {
  // Strong mandate bonus (0–25 pts)
  const mandateScore = Math.round(Math.max(0, (bluePct - 50) / 50) * 25)

  // Wiki stewardship (0–20 pts) — active editing = community ownership
  const wikiScore = Math.min(wikiRevisions * 4, 20)

  // Ratified amendments (0–15 pts) — successful evolution
  const amendmentSuccess = Math.min(ratifiedAmendments * 5, 15)

  // Challenge pressure penalty (-25 pts max)
  const challengePenalty = Math.min(openChallenges * 5 + (totalChallenges - openChallenges), 25)

  // Pending amendment friction (-15 pts max)
  const amendmentPenalty = Math.min(pendingAmendments * 3, 15)

  // Stability bonus — older laws that survive are stable (0–15 pts)
  const stabilityBonus = Math.min(Math.floor(daysSincePassage / 30) * 2, 15)

  const score = mandateScore + wikiScore + amendmentSuccess + stabilityBonus
    - challengePenalty - amendmentPenalty

  return Math.max(0, Math.min(100, Math.round(score)))
}

function adoptionLabel(score: number): LawAdoptionData['adoptionLabel'] {
  if (score >= 75) return 'Thriving'
  if (score >= 58) return 'Stable'
  if (score >= 42) return 'Active'
  if (score >= 25) return 'Pressured'
  return 'At Risk'
}

// ─── GET /api/laws/[id]/adoption ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const lawId = params.id

  // Law info
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const establishedAt = law.established_at ? new Date(law.established_at) : new Date()
  const daysSincePassage = Math.floor((Date.now() - establishedAt.getTime()) / 86_400_000)

  // Parallel data fetches
  const [challengesRes, amendmentsRes, revisionsRes, reviewsRes, debatesRes] = await Promise.all([
    db
      .from('law_challenges')
      .select('id, title, grounds, status, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(50),

    db
      .from('law_amendments')
      .select('id, title, status, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(50),

    db
      .from('law_revisions')
      .select('id, revision_num, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(50),

    db
      .from('law_reviews')
      .select('id, stars, created_at')
      .eq('law_id', lawId)
      .limit(200),

    law.topic_id
      ? db
          .from('debates')
          .select('id, title, status, scheduled_at, created_at')
          .eq('topic_id', law.topic_id)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  const challenges = (challengesRes.data ?? []) as {
    id: string; title: string; grounds: string; status: string; created_at: string
  }[]
  const amendments = (amendmentsRes.data ?? []) as {
    id: string; title: string; status: string; created_at: string
  }[]
  const revisions = (revisionsRes.data ?? []) as {
    id: string; revision_num: number; created_at: string
  }[]
  const reviews = (reviewsRes.data ?? []) as { id: string; stars: number; created_at: string }[]
  const debates = (debatesRes.data ?? []) as {
    id: string; title: string | null; status: string; scheduled_at: string | null; created_at: string
  }[]

  // Aggregates
  const openChallenges = challenges.filter((c) => c.status === 'open').length
  const pendingAmendments = amendments.filter((a) => a.status === 'pending').length
  const ratifiedAmendments = amendments.filter((a) => a.status === 'ratified').length
  const avgStars = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length
    : null

  // Adoption score
  const adoptionScore = computeAdoptionScore(
    daysSincePassage,
    openChallenges,
    challenges.length,
    pendingAmendments,
    ratifiedAmendments,
    revisions.length,
    law.blue_pct ?? 50,
  )

  // Friction breakdown
  const challengeFriction = Math.min(100, openChallenges * 20 + challenges.length * 5)
  const amendmentPressure = Math.min(100, pendingAmendments * 25)
  const overallFriction = Math.round((challengeFriction + amendmentPressure) / 2)

  // Signals
  const signals: AdoptionSignal[] = [
    {
      label: 'Original Mandate',
      value: Math.round(law.blue_pct ?? 50),
      trend: (law.blue_pct ?? 50) >= 70 ? 'up' : (law.blue_pct ?? 50) >= 55 ? 'flat' : 'down',
      description: `Passed with ${Math.round(law.blue_pct ?? 50)}% consensus across ${(law.total_votes ?? 0).toLocaleString()} votes`,
    },
    {
      label: 'Wiki Stewardship',
      value: Math.min(100, revisions.length * 10),
      trend: revisions.length > 3 ? 'up' : revisions.length > 0 ? 'flat' : 'down',
      description: `${revisions.length} wiki revision${revisions.length !== 1 ? 's' : ''} — community ownership signal`,
    },
    {
      label: 'Challenge Pressure',
      value: challengeFriction,
      trend: openChallenges > 0 ? 'down' : challenges.length > 0 ? 'flat' : 'up',
      description: `${openChallenges} open challenge${openChallenges !== 1 ? 's' : ''} of ${challenges.length} total filed`,
    },
    {
      label: 'Amendment Activity',
      value: amendmentPressure,
      trend: pendingAmendments > 0 ? 'flat' : ratifiedAmendments > 0 ? 'up' : 'flat',
      description: `${pendingAmendments} pending, ${ratifiedAmendments} ratified amendment${ratifiedAmendments !== 1 ? 's' : ''}`,
    },
    {
      label: 'Community Rating',
      value: avgStars !== null ? Math.round((avgStars / 5) * 100) : 50,
      trend: avgStars !== null ? (avgStars >= 4 ? 'up' : avgStars >= 3 ? 'flat' : 'down') : 'flat',
      description: avgStars !== null
        ? `${avgStars.toFixed(1)}/5 stars across ${reviews.length} review${reviews.length !== 1 ? 's' : ''}`
        : 'No community reviews yet',
    },
  ]

  // Timeline — merge all events sorted by date
  const timelineEvents: AdoptionEvent[] = [
    ...challenges.map((c) => ({
      type: 'challenge' as const,
      title: c.title,
      date: c.created_at,
      status: c.status,
      link: `/law/${lawId}/challenge`,
    })),
    ...amendments.map((a) => ({
      type: 'amendment' as const,
      title: a.title,
      date: a.created_at,
      status: a.status,
      link: `/law/${lawId}/amendments`,
    })),
    ...revisions.slice(0, 10).map((r) => ({
      type: 'wiki_edit' as const,
      title: `Wiki revision #${r.revision_num}`,
      date: r.created_at,
      link: `/law/${lawId}/wiki-history`,
    })),
    ...debates.slice(0, 5).map((d) => ({
      type: 'debate' as const,
      title: d.title ?? 'Debate',
      date: d.scheduled_at ?? d.created_at,
      status: d.status,
      link: `/debate/${d.id}`,
    })),
  ]

  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const payload: LawAdoptionData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      topic_id: law.topic_id,
    },
    adoptionScore,
    adoptionLabel: adoptionLabel(adoptionScore),
    signals,
    timeline: timelineEvents.slice(0, 20),
    stats: {
      daysSincePassage,
      challengeCount: challenges.length,
      openChallenges,
      amendmentCount: amendments.length,
      ratifiedAmendments,
      pendingAmendments,
      wikiRevisions: revisions.length,
      debatesCount: debates.length,
      reviewCount: reviews.length,
      avgStars,
    },
    friction: {
      challengeFriction,
      amendmentPressure,
      overallFriction,
    },
  }

  return NextResponse.json(payload)
}
