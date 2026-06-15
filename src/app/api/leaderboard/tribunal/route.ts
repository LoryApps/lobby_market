import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type TribunalTier = 'chief_justice' | 'senior_juror' | 'juror' | 'associate' | 'observer'

export interface TribunalJurorEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Service stats
  cases_served: number        // total cases where they cast a vote
  verdicts_cast: number       // cases where vote is non-null
  correct_verdicts: number    // verdicts matching the final case verdict
  accuracy: number            // correct / decided (0–1)
  // Score
  juror_score: number
  tier: TribunalTier
}

export interface TribunalChallengerEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Challenge stats
  total_challenges: number
  sustained_challenges: number   // cases that ended with 'sustained' verdict
  dismissed_challenges: number   // cases that ended with 'dismissed' verdict
  pending_challenges: number     // open/deliberating cases
  accuracy: number               // sustained / resolved (0–1)
  challenger_score: number
}

export interface TribunalMyStats {
  mode: 'juror' | 'challenger'
  juror_rank: number | null
  challenger_rank: number | null
  cases_served: number
  verdicts_cast: number
  correct_verdicts: number
  juror_accuracy: number
  juror_score: number
  juror_tier: TribunalTier
  total_challenges: number
  sustained_challenges: number
  challenge_accuracy: number
}

export interface TribunalStats {
  total_cases: number
  open_cases: number
  closed_cases: number
  sustained_total: number
  dismissed_total: number
  total_jurors: number
  total_challengers: number
}

export interface TribunalLeaderboardResponse {
  jurors: TribunalJurorEntry[]
  challengers: TribunalChallengerEntry[]
  stats: TribunalStats
  my_stats: TribunalMyStats | null
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getJurorTier(score: number): TribunalTier {
  if (score >= 150) return 'chief_justice'
  if (score >= 60)  return 'senior_juror'
  if (score >= 20)  return 'juror'
  if (score >= 5)   return 'associate'
  return 'observer'
}

// ─── Score formula ────────────────────────────────────────────────────────────
// juror_score = verdicts_cast × 2 + correct_verdicts × 3
// Minimum 3 verdicts to appear.

const MIN_VERDICTS = 3

function calcJurorScore(verdicts_cast: number, correct_verdicts: number): number {
  return verdicts_cast * 2 + correct_verdicts * 3
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch all closed tribunal cases with verdicts ─────────────────────

  const { data: closedCases, error: caseError } = await supabase
    .from('tribunal_cases')
    .select('id, verdict, status, created_at')

  if (caseError) {
    return NextResponse.json({ error: caseError.message }, { status: 500 })
  }

  const cases = closedCases ?? []
  const closedCaseMap = new Map<string, string | null>() // case_id -> verdict (null if open)
  cases.forEach(c => closedCaseMap.set(c.id, c.verdict))

  // ── 2. Fetch all juror votes ──────────────────────────────────────────────

  const { data: jurorVoteRows, error: jurorError } = await supabase
    .from('tribunal_juror_votes')
    .select('juror_id, case_id, vote, voted_at')

  if (jurorError) {
    return NextResponse.json({ error: jurorError.message }, { status: 500 })
  }

  // ── 3. Aggregate juror stats ──────────────────────────────────────────────

  type JurorAgg = {
    cases_served: number
    verdicts_cast: number
    correct_verdicts: number
  }

  const jurorAgg = new Map<string, JurorAgg>()

  for (const row of jurorVoteRows ?? []) {
    const agg = jurorAgg.get(row.juror_id) ?? { cases_served: 0, verdicts_cast: 0, correct_verdicts: 0 }
    agg.cases_served++
    if (row.vote) {
      agg.verdicts_cast++
      const caseVerdict = closedCaseMap.get(row.case_id)
      if (caseVerdict && row.vote === caseVerdict) {
        agg.correct_verdicts++
      }
    }
    jurorAgg.set(row.juror_id, agg)
  }

  // ── 4. Fetch tribunal challenges ──────────────────────────────────────────

  const { data: challengeRows, error: challengeError } = await supabase
    .from('tribunal_challenges')
    .select('challenger_id, argument_id')

  if (challengeError) {
    return NextResponse.json({ error: challengeError.message }, { status: 500 })
  }

  // Map argument_id -> case verdict
  const { data: caseArgRows } = await supabase
    .from('tribunal_cases')
    .select('argument_id, verdict, status')

  const argVerdictMap = new Map<string, { verdict: string | null; status: string }>()
  for (const c of caseArgRows ?? []) {
    argVerdictMap.set(c.argument_id, { verdict: c.verdict, status: c.status })
  }

  // ── 5. Aggregate challenger stats ─────────────────────────────────────────

  type ChallengerAgg = {
    total: number
    sustained: number
    dismissed: number
    pending: number
  }

  const challengerAgg = new Map<string, ChallengerAgg>()

  for (const row of challengeRows ?? []) {
    const agg = challengerAgg.get(row.challenger_id) ?? { total: 0, sustained: 0, dismissed: 0, pending: 0 }
    agg.total++
    const caseInfo = argVerdictMap.get(row.argument_id)
    if (!caseInfo) {
      // No case yet (< 3 challenges reached)
      agg.pending++
    } else if (caseInfo.status === 'closed') {
      if (caseInfo.verdict === 'sustained') agg.sustained++
      else agg.dismissed++
    } else {
      agg.pending++
    }
    challengerAgg.set(row.challenger_id, agg)
  }

  // ── 6. Fetch all relevant profiles ───────────────────────────────────────

  const allUserIds = new Set([
    ...jurorAgg.keys(),
    ...challengerAgg.keys(),
  ])

  if (allUserIds.size === 0) {
    const stats: TribunalStats = {
      total_cases: cases.length,
      open_cases: cases.filter(c => c.status === 'open').length,
      closed_cases: cases.filter(c => c.status === 'closed').length,
      sustained_total: cases.filter(c => c.verdict === 'sustained').length,
      dismissed_total: cases.filter(c => c.verdict === 'dismissed').length,
      total_jurors: 0,
      total_challengers: 0,
    }
    return NextResponse.json({
      jurors: [],
      challengers: [],
      stats,
      my_stats: null,
      generated_at: new Date().toISOString(),
    })
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', [...allUserIds])

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // ── 7. Build juror entries ────────────────────────────────────────────────

  const jurorEntries: TribunalJurorEntry[] = []

  for (const [userId, agg] of jurorAgg.entries()) {
    if (agg.verdicts_cast < MIN_VERDICTS) continue
    const profile = profileMap.get(userId)
    if (!profile) continue
    const score = calcJurorScore(agg.verdicts_cast, agg.correct_verdicts)
    const accuracy = agg.verdicts_cast > 0 ? agg.correct_verdicts / agg.verdicts_cast : 0
    jurorEntries.push({
      rank: 0,
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      cases_served: agg.cases_served,
      verdicts_cast: agg.verdicts_cast,
      correct_verdicts: agg.correct_verdicts,
      accuracy,
      juror_score: score,
      tier: getJurorTier(score),
    })
  }

  jurorEntries.sort((a, b) => b.juror_score - a.juror_score)
  jurorEntries.forEach((e, i) => { e.rank = i + 1 })

  // ── 8. Build challenger entries ───────────────────────────────────────────

  const challengerEntries: TribunalChallengerEntry[] = []

  for (const [userId, agg] of challengerAgg.entries()) {
    if (agg.total < 1) continue
    const profile = profileMap.get(userId)
    if (!profile) continue
    const resolved = agg.sustained + agg.dismissed
    const accuracy = resolved > 0 ? agg.sustained / resolved : 0
    const score = agg.sustained * 5 + agg.total * 1
    challengerEntries.push({
      rank: 0,
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      total_challenges: agg.total,
      sustained_challenges: agg.sustained,
      dismissed_challenges: agg.dismissed,
      pending_challenges: agg.pending,
      accuracy,
      challenger_score: score,
    })
  }

  challengerEntries.sort((a, b) => b.challenger_score - a.challenger_score)
  challengerEntries.forEach((e, i) => { e.rank = i + 1 })

  // ── 9. My stats ───────────────────────────────────────────────────────────

  let my_stats: TribunalMyStats | null = null

  if (user) {
    const myJuror = jurorAgg.get(user.id) ?? { cases_served: 0, verdicts_cast: 0, correct_verdicts: 0 }
    const myChallenger = challengerAgg.get(user.id) ?? { total: 0, sustained: 0, dismissed: 0, pending: 0 }
    const myJurorScore = calcJurorScore(myJuror.verdicts_cast, myJuror.correct_verdicts)
    const myJurorRank = jurorEntries.findIndex(e => e.user_id === user.id)
    const myChallengerRank = challengerEntries.findIndex(e => e.user_id === user.id)
    const myResolved = myChallenger.sustained + myChallenger.dismissed

    my_stats = {
      mode: myJuror.verdicts_cast >= myChallenger.total ? 'juror' : 'challenger',
      juror_rank: myJurorRank >= 0 ? myJurorRank + 1 : null,
      challenger_rank: myChallengerRank >= 0 ? myChallengerRank + 1 : null,
      cases_served: myJuror.cases_served,
      verdicts_cast: myJuror.verdicts_cast,
      correct_verdicts: myJuror.correct_verdicts,
      juror_accuracy: myJuror.verdicts_cast > 0 ? myJuror.correct_verdicts / myJuror.verdicts_cast : 0,
      juror_score: myJurorScore,
      juror_tier: getJurorTier(myJurorScore),
      total_challenges: myChallenger.total,
      sustained_challenges: myChallenger.sustained,
      challenge_accuracy: myResolved > 0 ? myChallenger.sustained / myResolved : 0,
    }
  }

  // ── 10. Platform stats ────────────────────────────────────────────────────

  const stats: TribunalStats = {
    total_cases: cases.length,
    open_cases: cases.filter(c => c.status === 'open').length,
    closed_cases: cases.filter(c => c.status === 'closed').length,
    sustained_total: cases.filter(c => c.verdict === 'sustained').length,
    dismissed_total: cases.filter(c => c.verdict === 'dismissed').length,
    total_jurors: jurorEntries.length,
    total_challengers: challengerEntries.length,
  }

  return NextResponse.json({
    jurors: jurorEntries.slice(0, 100),
    challengers: challengerEntries.slice(0, 100),
    stats,
    my_stats,
    generated_at: new Date().toISOString(),
  } satisfies TribunalLeaderboardResponse)
}
