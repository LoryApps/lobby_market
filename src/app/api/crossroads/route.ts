import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Dilemma registry ─────────────────────────────────────────────────────────

export interface CrossroadsDilemma {
  id: string
  week: number
  title: string
  scenario: string
  valueA: string
  descA: string
  colorA: string // tailwind color class prefix
  valueB: string
  descB: string
  colorB: string
  quote: string
  quoteAuthor: string
}

const DILEMMAS: CrossroadsDilemma[] = [
  {
    id: 'freedom-vs-safety',
    week: 0,
    title: 'The First Crossroads',
    scenario:
      'A new technology can predict crime with 94% accuracy — but requires continuous surveillance of every citizen. The government proposes mandatory rollout to eliminate violent crime.',
    valueA: 'Freedom',
    descA: 'Privacy and autonomy are inviolable. No state surveillance, even for safety.',
    colorA: 'for',
    valueB: 'Safety',
    descB: 'Preventing harm justifies monitoring. 94% fewer victims is worth the trade-off.',
    colorB: 'against',
    quote: 'Those who would give up essential liberty to purchase a little temporary safety deserve neither.',
    quoteAuthor: 'Benjamin Franklin',
  },
  {
    id: 'growth-vs-earth',
    week: 1,
    title: 'The Second Crossroads',
    scenario:
      'A major industrial project would create 200,000 jobs and lift millions out of poverty — but will permanently destroy one of the last pristine ecosystems on Earth.',
    valueA: 'Prosperity',
    descA: 'Human welfare comes first. Economic development saves lives today.',
    colorA: 'gold',
    valueB: 'Planet',
    descB: 'The ecosystem is irreplaceable. Future generations have equal claim to the Earth.',
    colorB: 'emerald',
    quote: 'We do not inherit the earth from our ancestors; we borrow it from our children.',
    quoteAuthor: 'Antoine de Saint-Exupéry',
  },
  {
    id: 'equality-vs-merit',
    week: 2,
    title: 'The Third Crossroads',
    scenario:
      'Society can be restructured for perfect equality of outcome — everyone receives the same resources regardless of effort — or pure meritocracy, where rewards exactly match contribution.',
    valueA: 'Equality',
    descA: 'No person deserves less dignity. Equal outcomes create a just society.',
    colorA: 'for',
    valueB: 'Merit',
    descB: 'Rewarding effort creates incentives. The best outcomes come from earned rewards.',
    colorB: 'purple',
    quote: 'The only way to make men love one another is to make men equal.',
    quoteAuthor: 'John Rawls',
  },
  {
    id: 'tradition-vs-progress',
    week: 3,
    title: 'The Fourth Crossroads',
    scenario:
      'A rapid social reform will dramatically improve quality of life for marginalized groups — but requires dismantling institutions that have provided stability for centuries.',
    valueA: 'Tradition',
    descA: 'Proven institutions are hard to rebuild. Change must be gradual and tested.',
    colorA: 'gold',
    valueB: 'Progress',
    descB: 'Institutions that harm people have no right to persist. Change is moral duty.',
    colorB: 'for',
    quote: 'The measure of intelligence is the ability to change.',
    quoteAuthor: 'Albert Einstein',
  },
  {
    id: 'local-vs-global',
    week: 4,
    title: 'The Fifth Crossroads',
    scenario:
      'A global crisis can only be solved by surrendering significant national sovereignty to an unelected international body with enforcement powers over all member nations.',
    valueA: 'Sovereignty',
    descA: 'Nations must remain self-governing. Democratic legitimacy requires local control.',
    colorA: 'against',
    valueB: 'Unity',
    descB: 'Existential problems need global solutions. Some sovereignty is worth sacrificing.',
    colorB: 'for',
    quote: 'Nationalism is an infantile thing. It is the measles of mankind.',
    quoteAuthor: 'Albert Einstein',
  },
  {
    id: 'privacy-vs-transparency',
    week: 5,
    title: 'The Sixth Crossroads',
    scenario:
      'Full government transparency — every official communication, budget item, and decision made public in real time — but citizens also lose all digital privacy in return.',
    valueA: 'Privacy',
    descA: 'Personal data is a right. The state has no claim on private life.',
    colorA: 'for',
    valueB: 'Transparency',
    descB: 'Democracy requires radical openness. Both citizens and governments must be visible.',
    colorB: 'purple',
    quote: 'The right to be left alone is the most comprehensive of rights and the right most valued by civilized men.',
    quoteAuthor: 'Justice Louis Brandeis',
  },
  {
    id: 'justice-vs-mercy',
    week: 6,
    title: 'The Seventh Crossroads',
    scenario:
      'The justice system can be reformed to focus entirely on rehabilitation with no punitive sentences — or return to strict deterrence-based sentencing with minimal rehabilitation.',
    valueA: 'Justice',
    descA: 'Actions have consequences. Deterrence protects society through accountability.',
    colorA: 'against',
    valueB: 'Mercy',
    descB: 'People can change. A society judged by how it treats its worst members.',
    colorB: 'emerald',
    quote: 'The quality of mercy is not strained; it droppeth as the gentle rain from heaven.',
    quoteAuthor: 'William Shakespeare',
  },
  {
    id: 'democracy-vs-expertise',
    week: 7,
    title: 'The Eighth Crossroads',
    scenario:
      'Complex policy decisions (climate, pandemics, economics) could be delegated entirely to verified expert panels — eliminating democratic vote but ensuring scientifically optimal outcomes.',
    valueA: 'Democracy',
    descA: 'Every voice must count. Technocracy without consent is tyranny.',
    colorA: 'for',
    valueB: 'Expertise',
    descB: 'Some questions have correct answers. Let those who know best decide.',
    colorB: 'purple',
    quote: 'The best argument against democracy is a five-minute conversation with the average voter.',
    quoteAuthor: 'Winston Churchill',
  },
]

// ─── Current dilemma selection ─────────────────────────────────────────────────

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
}

function getCurrentDilemma(): CrossroadsDilemma {
  const week = getWeekNumber()
  const index = week % DILEMMAS.length
  return { ...DILEMMAS[index], week }
}

// ─── Response types ────────────────────────────────────────────────────────────

export interface CrossroadsStats {
  totalVotes: number
  countA: number
  countB: number
  pctA: number
  pctB: number
}

export interface CrossroadsResponse {
  dilemma: CrossroadsDilemma
  stats: CrossroadsStats
  userVote: 'A' | 'B' | null
  history: { dilemmaId: string; choice: 'A' | 'B' }[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const dilemma = getCurrentDilemma()

  const { data: { user } } = await supabase.auth.getUser()

  // Aggregate counts for this dilemma
  const { data: rows } = await supabase
    .from('crossroads_votes')
    .select('choice')
    .eq('dilemma_id', dilemma.id)

  const countA = (rows ?? []).filter((r) => r.choice === 'A').length
  const countB = (rows ?? []).filter((r) => r.choice === 'B').length
  const total = countA + countB

  const stats: CrossroadsStats = {
    totalVotes: total,
    countA,
    countB,
    pctA: total > 0 ? Math.round((countA / total) * 100) : 50,
    pctB: total > 0 ? Math.round((countB / total) * 100) : 50,
  }

  // User's vote on current dilemma
  let userVote: 'A' | 'B' | null = null
  let history: { dilemmaId: string; choice: 'A' | 'B' }[] = []

  if (user) {
    const { data: voteRow } = await supabase
      .from('crossroads_votes')
      .select('choice')
      .eq('user_id', user.id)
      .eq('dilemma_id', dilemma.id)
      .maybeSingle()

    if (voteRow) userVote = voteRow.choice as 'A' | 'B'

    // Past choices for profile
    const { data: histRows } = await supabase
      .from('crossroads_votes')
      .select('dilemma_id, choice')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    history = (histRows ?? []).map((r) => ({
      dilemmaId: r.dilemma_id,
      choice: r.choice as 'A' | 'B',
    }))
  }

  return NextResponse.json({ dilemma, stats, userVote, history } satisfies CrossroadsResponse)
}

// ─── POST — Cast a vote ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { choice } = body as { choice?: string }

  if (choice !== 'A' && choice !== 'B') {
    return NextResponse.json({ error: 'choice must be A or B' }, { status: 400 })
  }

  const dilemma = getCurrentDilemma()

  const { error } = await supabase
    .from('crossroads_votes')
    .insert({ user_id: user.id, dilemma_id: dilemma.id, choice })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already voted on this dilemma' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return fresh stats
  const { data: rows } = await supabase
    .from('crossroads_votes')
    .select('choice')
    .eq('dilemma_id', dilemma.id)

  const countA = (rows ?? []).filter((r) => r.choice === 'A').length
  const countB = (rows ?? []).filter((r) => r.choice === 'B').length
  const total = countA + countB

  return NextResponse.json({
    ok: true,
    stats: {
      totalVotes: total,
      countA,
      countB,
      pctA: total > 0 ? Math.round((countA / total) * 100) : 50,
      pctB: total > 0 ? Math.round((countB / total) * 100) : 50,
    } satisfies CrossroadsStats,
  })
}
