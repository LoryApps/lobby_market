import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawHealthStats {
  total_laws: number
  total_votes: number
  avg_blue_pct: number
  categories: Array<{ category: string; count: number }>
}

export interface ChallengedLaw {
  id: string
  statement: string
  category: string | null
  challenge_count: number
  open_challenges: number
  established_at: string
  blue_pct: number | null
  total_votes: number | null
}

export interface ContentiousLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  verdict_count: number
  success_pct: number
}

export interface ActiveLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  chat_count: number
  wiki_edits: number
  challenge_count: number
}

export interface WikidLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  wiki_edits: number
  has_wiki: boolean
}

export interface HealthMetrics {
  challenge_coverage: number   // % of laws with at least one challenge
  verdict_coverage: number     // % of laws with at least one verdict vote
  wiki_coverage: number        // % of laws with wiki content
  discussion_coverage: number  // % of laws with at least one chat message
  overall_health_score: number // composite 0–100
}

export interface LawHealthResponse {
  stats: LawHealthStats
  metrics: HealthMetrics
  most_challenged: ChallengedLaw[]
  most_contentious: ContentiousLaw[]  // high challenge-to-vote ratio
  most_active: ActiveLaw[]            // most discussion + wiki + challenge activity
  most_wikied: WikidLaw[]             // most wiki edits
  verdict_summary: {
    succeeded: number
    mostly_succeeded: number
    mixed: number
    mostly_failed: number
    failed: number
    total: number
  }
  generated_at: string
}

// ─── GET /api/laws/health ─────────────────────────────────────────────────────

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // 1. Fetch all active laws
  const { data: laws, error: lawsError } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, wiki_content, wiki_updated_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  if (lawsError || !laws) {
    return NextResponse.json({ error: 'Failed to fetch laws' }, { status: 500 })
  }

  const total_laws: number = laws.length

  if (total_laws === 0) {
    const empty: LawHealthResponse = {
      stats: { total_laws: 0, total_votes: 0, avg_blue_pct: 0, categories: [] },
      metrics: {
        challenge_coverage: 0, verdict_coverage: 0,
        wiki_coverage: 0, discussion_coverage: 0, overall_health_score: 0,
      },
      most_challenged: [], most_contentious: [], most_active: [], most_wikied: [],
      verdict_summary: { succeeded: 0, mostly_succeeded: 0, mixed: 0, mostly_failed: 0, failed: 0, total: 0 },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  const lawIds: string[] = laws.map((l: { id: string }) => l.id)

  // 2. Run all aggregation queries in parallel
  const [challengesRes, verdictsRes, chatRes, wikiHistRes] = await Promise.all([
    // Count challenges per law
    supabase
      .from('law_challenges')
      .select('law_id, status')
      .in('law_id', lawIds),

    // All verdict votes
    supabase
      .from('law_verdict_votes')
      .select('law_id, verdict')
      .in('law_id', lawIds),

    // Chat messages count per law
    supabase
      .from('law_chat_messages')
      .select('law_id')
      .in('law_id', lawIds),

    // Wiki edits per law
    supabase
      .from('law_wiki_history')
      .select('law_id')
      .in('law_id', lawIds),
  ])

  // 3. Build aggregate maps
  const challengeMap = new Map<string, { total: number; open: number }>()
  if (challengesRes.data) {
    for (const c of challengesRes.data) {
      const cur = challengeMap.get(c.law_id) ?? { total: 0, open: 0 }
      cur.total += 1
      if (c.status === 'open') cur.open += 1
      challengeMap.set(c.law_id, cur)
    }
  }

  const verdictMap = new Map<string, string[]>()
  const verdictTally = { succeeded: 0, mostly_succeeded: 0, mixed: 0, mostly_failed: 0, failed: 0, total: 0 }
  if (verdictsRes.data) {
    for (const v of verdictsRes.data) {
      const list = verdictMap.get(v.law_id) ?? []
      list.push(v.verdict)
      verdictMap.set(v.law_id, list)
      verdictTally.total += 1
      if (v.verdict in verdictTally) {
        (verdictTally as Record<string, number>)[v.verdict] += 1
      }
    }
  }

  const chatCountMap = new Map<string, number>()
  if (chatRes.data) {
    for (const c of chatRes.data) {
      chatCountMap.set(c.law_id, (chatCountMap.get(c.law_id) ?? 0) + 1)
    }
  }

  const wikiEditMap = new Map<string, number>()
  if (wikiHistRes.data) {
    for (const w of wikiHistRes.data) {
      wikiEditMap.set(w.law_id, (wikiEditMap.get(w.law_id) ?? 0) + 1)
    }
  }

  // 4. Compute metrics
  const lawsWithChallenge = laws.filter((l: { id: string }) => (challengeMap.get(l.id)?.total ?? 0) > 0).length
  const lawsWithVerdict = laws.filter((l: { id: string }) => (verdictMap.get(l.id)?.length ?? 0) > 0).length
  const lawsWithWiki = laws.filter((l: { id: string; wiki_content?: string | null }) => !!l.wiki_content).length
  const lawsWithChat = laws.filter((l: { id: string }) => (chatCountMap.get(l.id) ?? 0) > 0).length

  const challenge_coverage = total_laws > 0 ? Math.round((lawsWithChallenge / total_laws) * 100) : 0
  const verdict_coverage = total_laws > 0 ? Math.round((lawsWithVerdict / total_laws) * 100) : 0
  const wiki_coverage = total_laws > 0 ? Math.round((lawsWithWiki / total_laws) * 100) : 0
  const discussion_coverage = total_laws > 0 ? Math.round((lawsWithChat / total_laws) * 100) : 0
  // Health score rewards verdict + wiki coverage, and is penalized by high unresolved challenges
  const health_raw = (verdict_coverage * 0.3) + (wiki_coverage * 0.3) + (discussion_coverage * 0.2) + (challenge_coverage * 0.2)
  const overall_health_score = Math.round(health_raw)

  // 5. Top stats
  const total_votes = laws.reduce((s: number, l: { total_votes?: number | null }) => s + (l.total_votes ?? 0), 0)
  const avg_blue_pct = laws.length > 0
    ? Math.round(laws.reduce((s: number, l: { blue_pct?: number | null }) => s + (l.blue_pct ?? 50), 0) / laws.length)
    : 50

  const catCount = new Map<string, number>()
  for (const l of laws) {
    const cat = l.category ?? 'Uncategorised'
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1)
  }
  const categories = Array.from(catCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  // 6. Most challenged
  const most_challenged: ChallengedLaw[] = laws
    .map((l: { id: string; statement: string; category: string | null; established_at: string; blue_pct: number | null; total_votes: number | null }) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      established_at: l.established_at,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
      challenge_count: challengeMap.get(l.id)?.total ?? 0,
      open_challenges: challengeMap.get(l.id)?.open ?? 0,
    }))
    .filter((l: ChallengedLaw) => l.challenge_count > 0)
    .sort((a: ChallengedLaw, b: ChallengedLaw) => b.challenge_count - a.challenge_count)
    .slice(0, 8)

  // 7. Most contentious (high verdict count with mixed/failed verdicts)
  function verdictScore(verdicts: string[]): number {
    if (verdicts.length === 0) return 50
    const weights: Record<string, number> = {
      succeeded: 100, mostly_succeeded: 75, mixed: 50, mostly_failed: 25, failed: 0,
    }
    const avg = verdicts.reduce((s, v) => s + (weights[v] ?? 50), 0) / verdicts.length
    return Math.round(avg)
  }

  const most_contentious: ContentiousLaw[] = laws
    .map((l: { id: string; statement: string; category: string | null; established_at: string; blue_pct: number | null; total_votes: number | null }) => {
      const verdicts = verdictMap.get(l.id) ?? []
      return {
        id: l.id,
        statement: l.statement,
        category: l.category,
        established_at: l.established_at,
        blue_pct: l.blue_pct,
        total_votes: l.total_votes,
        verdict_count: verdicts.length,
        success_pct: verdictScore(verdicts),
      }
    })
    .filter((l: ContentiousLaw) => l.verdict_count >= 2)
    .sort((a: ContentiousLaw, b: ContentiousLaw) => {
      const scoreA = Math.abs(50 - a.success_pct) * a.verdict_count
      const scoreB = Math.abs(50 - b.success_pct) * b.verdict_count
      return scoreB - scoreA
    })
    .slice(0, 6)

  // 8. Most active (chat + wiki + challenges combined)
  const most_active: ActiveLaw[] = laws
    .map((l: { id: string; statement: string; category: string | null; established_at: string; blue_pct: number | null }) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      established_at: l.established_at,
      blue_pct: l.blue_pct,
      chat_count: chatCountMap.get(l.id) ?? 0,
      wiki_edits: wikiEditMap.get(l.id) ?? 0,
      challenge_count: challengeMap.get(l.id)?.total ?? 0,
    }))
    .filter((l: ActiveLaw) => l.chat_count + l.wiki_edits + l.challenge_count > 0)
    .sort((a: ActiveLaw, b: ActiveLaw) => {
      const scoreA = a.chat_count * 1 + a.wiki_edits * 2 + a.challenge_count * 3
      const scoreB = b.chat_count * 1 + b.wiki_edits * 2 + b.challenge_count * 3
      return scoreB - scoreA
    })
    .slice(0, 6)

  // 9. Most wiki-edited
  const most_wikied: WikidLaw[] = laws
    .map((l: { id: string; statement: string; category: string | null; established_at: string; blue_pct: number | null; wiki_content?: string | null }) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      established_at: l.established_at,
      blue_pct: l.blue_pct,
      wiki_edits: wikiEditMap.get(l.id) ?? 0,
      has_wiki: !!l.wiki_content,
    }))
    .filter((l: WikidLaw) => l.wiki_edits > 0 || l.has_wiki)
    .sort((a: WikidLaw, b: WikidLaw) => b.wiki_edits - a.wiki_edits)
    .slice(0, 6)

  const response: LawHealthResponse = {
    stats: { total_laws, total_votes, avg_blue_pct, categories },
    metrics: { challenge_coverage, verdict_coverage, wiki_coverage, discussion_coverage, overall_health_score },
    most_challenged,
    most_contentious,
    most_active,
    most_wikied,
    verdict_summary: verdictTally,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
