import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour — resolved topics don't change

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutopsyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface VoteDay {
  date: string        // YYYY-MM-DD
  for_votes: number
  against_votes: number
  running_for: number
  running_against: number
  running_pct: number // blue_pct at that point
}

export interface VerdictStrength {
  label: 'Unanimous' | 'Landslide' | 'Decisive' | 'Majority' | 'Narrow'
  description: string
  color: string
}

export interface AutopsyPhase {
  label: string
  description: string
  date_range: string
  pct_at_end: number
  votes_in_phase: number
}

export interface CategoryBenchmark {
  total_resolved: number
  avg_blue_pct: number
  avg_votes: number
  law_rate: number // % that became law
}

export interface AutopsyData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: 'law' | 'failed'
    blue_pct: number
    blue_votes: number
    red_votes: number
    total_votes: number
    total_arguments: number
    view_count: number
    created_at: string
    voting_ends_at: string | null
    debate_days: number
  }
  verdict: VerdictStrength
  vote_arc: VoteDay[]
  peak_for_day: VoteDay | null
  peak_against_day: VoteDay | null
  top_for_args: AutopsyArgument[]
  top_against_args: AutopsyArgument[]
  phases: AutopsyPhase[]
  category_benchmark: CategoryBenchmark | null
  debate_density: number // arguments per vote (0–1, higher = more argued)
  engagement_rate: number // votes / views (0–1)
}

// ─── Verdict strength helper ──────────────────────────────────────────────────

function getVerdictStrength(bluePct: number, status: 'law' | 'failed'): VerdictStrength {
  const winPct = status === 'law' ? bluePct : 100 - bluePct

  if (winPct >= 90) return {
    label: 'Unanimous',
    description: 'Near-total community agreement — virtually no dissent.',
    color: 'emerald',
  }
  if (winPct >= 75) return {
    label: 'Landslide',
    description: 'A decisive, overwhelming verdict with strong majority backing.',
    color: 'emerald',
  }
  if (winPct >= 65) return {
    label: 'Decisive',
    description: 'A clear result — the community spoke with confidence.',
    color: 'for-400',
  }
  if (winPct >= 55) return {
    label: 'Majority',
    description: 'A solid majority prevailed but meaningful opposition remained.',
    color: 'gold',
  }
  return {
    label: 'Narrow',
    description: 'A razor-thin outcome — the debate could have gone either way.',
    color: 'against-300',
  }
}

// ─── Phase builder ────────────────────────────────────────────────────────────

function buildPhases(arc: VoteDay[]): AutopsyPhase[] {
  if (arc.length < 2) return []

  const third = Math.floor(arc.length / 3)
  const twoThirds = Math.floor((arc.length * 2) / 3)

  const early = arc.slice(0, Math.max(1, third))
  const middle = arc.slice(early.length, Math.max(early.length + 1, twoThirds))
  const climax = arc.slice(middle.length + early.length)

  function phaseVotes(days: VoteDay[]) {
    return days.reduce((s, d) => s + d.for_votes + d.against_votes, 0)
  }

  function phaseDateRange(days: VoteDay[]) {
    if (!days.length) return ''
    const first = days[0].date.slice(5) // MM-DD
    const last = days[days.length - 1].date.slice(5)
    return first === last ? first : `${first} → ${last}`
  }

  const phases: AutopsyPhase[] = []

  if (early.length) {
    const endPct = early[early.length - 1].running_pct
    phases.push({
      label: 'Opening',
      description: 'Early votes set the initial lean — first impressions formed.',
      date_range: phaseDateRange(early),
      pct_at_end: Math.round(endPct),
      votes_in_phase: phaseVotes(early),
    })
  }

  if (middle.length) {
    const endPct = middle[middle.length - 1].running_pct
    phases.push({
      label: 'Development',
      description: 'Arguments sharpened, the community engaged in earnest.',
      date_range: phaseDateRange(middle),
      pct_at_end: Math.round(endPct),
      votes_in_phase: phaseVotes(middle),
    })
  }

  if (climax.length) {
    const endPct = climax[climax.length - 1].running_pct
    phases.push({
      label: 'Resolution',
      description: 'Final hours — the verdict crystallised.',
      date_range: phaseDateRange(climax),
      pct_at_end: Math.round(endPct),
      votes_in_phase: phaseVotes(climax),
    })
  }

  return phases
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // ── 1. Topic ──────────────────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select(
        'id, statement, category, status, blue_pct, blue_votes, red_votes, ' +
        'total_votes, view_count, created_at, voting_ends_at'
      )
      .eq('id', params.id)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (topic.status !== 'law' && topic.status !== 'failed') {
      return NextResponse.json({ error: 'not_resolved' }, { status: 422 })
    }

    const resolvedAt = topic.voting_ends_at
      ? new Date(topic.voting_ends_at)
      : new Date(topic.created_at)
    const createdAt = new Date(topic.created_at)
    const debateDays = Math.max(
      1,
      Math.round((resolvedAt.getTime() - createdAt.getTime()) / 86_400_000)
    )

    // ── 2. Vote arc ───────────────────────────────────────────────────────────
    // Group individual votes by day to reconstruct vote trajectory
    const { data: voteRows } = await supabase
      .from('votes')
      .select('side, created_at')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: true })
      .limit(10000)

    const dayMap = new Map<string, { for: number; against: number }>()

    for (const v of voteRows ?? []) {
      const day = v.created_at.slice(0, 10) // YYYY-MM-DD
      if (!dayMap.has(day)) dayMap.set(day, { for: 0, against: 0 })
      const entry = dayMap.get(day)!
      if (v.side === 'blue') entry.for++
      else entry.against++
    }

    let runFor = 0
    let runAgainst = 0
    const voteArc: VoteDay[] = []

    for (const [date, counts] of Array.from(dayMap.entries()).sort()) {
      runFor += counts.for
      runAgainst += counts.against
      const total = runFor + runAgainst
      voteArc.push({
        date,
        for_votes: counts.for,
        against_votes: counts.against,
        running_for: runFor,
        running_against: runAgainst,
        running_pct: total > 0 ? Math.round((runFor / total) * 100) : 50,
      })
    }

    // Find peak days for each side
    let peakForDay: VoteDay | null = null
    let peakAgainstDay: VoteDay | null = null
    for (const d of voteArc) {
      if (!peakForDay || d.for_votes > peakForDay.for_votes) peakForDay = d
      if (!peakAgainstDay || d.against_votes > peakAgainstDay.against_votes) peakAgainstDay = d
    }

    // ── 3. Arguments ──────────────────────────────────────────────────────────
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select(
        'id, content, side, upvotes, created_at, ' +
        'profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url)'
      )
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .limit(20)

    const totalArguments = argRows?.length ?? 0

    function mapArg(row: {
      id: string
      content: string
      side: string
      upvotes: number
      created_at: string
      profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
    }): AutopsyArgument {
      return {
        id: row.id,
        content: row.content,
        side: row.side as 'blue' | 'red',
        upvotes: row.upvotes,
        created_at: row.created_at,
        author_username: row.profiles?.username ?? null,
        author_display_name: row.profiles?.display_name ?? null,
        author_avatar_url: row.profiles?.avatar_url ?? null,
      }
    }

    const topForArgs = (argRows ?? [])
      .filter((r) => r.side === 'blue')
      .slice(0, 3)
      .map((r) => mapArg(r as Parameters<typeof mapArg>[0]))

    const topAgainstArgs = (argRows ?? [])
      .filter((r) => r.side === 'red')
      .slice(0, 3)
      .map((r) => mapArg(r as Parameters<typeof mapArg>[0]))

    // ── 4. Category benchmark ─────────────────────────────────────────────────
    let categoryBenchmark: CategoryBenchmark | null = null

    if (topic.category) {
      const { data: benchRows } = await supabase
        .from('topics')
        .select('status, blue_pct, total_votes')
        .eq('category', topic.category)
        .in('status', ['law', 'failed'])
        .neq('id', params.id)
        .limit(200)

      if (benchRows && benchRows.length > 0) {
        const laws = benchRows.filter((r) => r.status === 'law').length
        const avgBluePct =
          benchRows.reduce((s, r) => s + (r.blue_pct ?? 50), 0) / benchRows.length
        const avgVotes =
          benchRows.reduce((s, r) => s + (r.total_votes ?? 0), 0) / benchRows.length

        categoryBenchmark = {
          total_resolved: benchRows.length,
          avg_blue_pct: Math.round(avgBluePct),
          avg_votes: Math.round(avgVotes),
          law_rate: Math.round((laws / benchRows.length) * 100),
        }
      }
    }

    // ── 5. Derived metrics ────────────────────────────────────────────────────
    const bluePct = topic.blue_pct ?? 50
    const totalVotes = topic.total_votes ?? 0
    const viewCount = topic.view_count ?? 0

    const verdict = getVerdictStrength(bluePct, topic.status as 'law' | 'failed')
    const phases = buildPhases(voteArc)
    const debateDensity =
      totalVotes > 0 ? Math.min(1, totalArguments / totalVotes) : 0
    const engagementRate =
      viewCount > 0 ? Math.min(1, totalVotes / viewCount) : 0

    const response: AutopsyData = {
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status as 'law' | 'failed',
        blue_pct: bluePct,
        blue_votes: topic.blue_votes ?? 0,
        red_votes: topic.red_votes ?? 0,
        total_votes: totalVotes,
        total_arguments: totalArguments,
        view_count: viewCount,
        created_at: topic.created_at,
        voting_ends_at: topic.voting_ends_at,
        debate_days: debateDays,
      },
      verdict,
      vote_arc: voteArc,
      peak_for_day: peakForDay,
      peak_against_day: peakAgainstDay,
      top_for_args: topForArgs,
      top_against_args: topAgainstArgs,
      phases,
      category_benchmark: categoryBenchmark,
      debate_density: Math.round(debateDensity * 100) / 100,
      engagement_rate: Math.round(engagementRate * 100) / 100,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[autopsy]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
