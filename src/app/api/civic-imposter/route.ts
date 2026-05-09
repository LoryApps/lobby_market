import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImposterLaw {
  id: string
  statement: string
  category: string | null
  is_fake: boolean
}

export interface ImposterPayload {
  date: string
  laws: ImposterLaw[]
  fake_index: number  // index in the shuffled laws array (so client can reveal after guess)
}

// ─── Pre-written fake laws ────────────────────────────────────────────────────
// 31 plausible civic policy statements that do not exist in the Codex.
// Rotated daily by index so the game stays fresh for a full month.

const FAKE_LAWS: Array<{ statement: string; category: string }> = [
  { statement: 'Citizens who participate in jury duty more than three times in a decade shall receive priority consideration in public housing applications.', category: 'Justice' },
  { statement: 'All employers with more than 50 workers must provide at least 30 minutes of dedicated outdoor access during each working day.', category: 'Labour' },
  { statement: 'Social media platforms must allow users to export their full data archive within 48 hours of any written request.', category: 'Technology' },
  { statement: 'Local authorities must plant one tree for every 100 square metres of new paved or sealed surface approved for construction.', category: 'Environment' },
  { statement: 'Citizens aged 16 and above shall be permitted to vote in all municipal and local council elections.', category: 'Democracy' },
  { statement: 'All pharmaceutical advertisements on broadcast media must display comparative pricing with the lowest-cost generic alternative.', category: 'Health' },
  { statement: 'Public transport fares shall not exceed 2% of the national minimum hourly wage per single adult journey.', category: 'Economics' },
  { statement: 'All new residential developments of 20 or more units must designate at least 10% of floor space as affordable housing.', category: 'Housing' },
  { statement: 'Government agencies must respond to all public records requests within five working days of receipt.', category: 'Transparency' },
  { statement: 'Workers classified as independent contractors must receive no less than the equivalent hourly rate paid to comparable permanent employees.', category: 'Labour' },
  { statement: 'All schools must allocate a minimum of 60 minutes per week to structured civic and constitutional education.', category: 'Education' },
  { statement: 'Electoral candidates must publish their personal tax returns for the previous five years before filing nomination papers.', category: 'Democracy' },
  { statement: 'Any statute that has been in effect for 25 years without amendment shall be subject to mandatory parliamentary review.', category: 'Governance' },
  { statement: 'Online retailers operating in this jurisdiction must offset 100% of delivery-related carbon emissions through certified credits.', category: 'Environment' },
  { statement: 'All polling stations must remain open for a minimum of 14 consecutive hours on national election days.', category: 'Democracy' },
  { statement: 'Citizens may submit binding policy referenda with the verified support of 1% of the registered voting population.', category: 'Democracy' },
  { statement: 'Corporations must disclose all lobbying expenditures exceeding $5,000 within 30 days to a publicly accessible register.', category: 'Transparency' },
  { statement: 'All food packaging must clearly state the country of origin for each primary ingredient comprising more than 5% of the product.', category: 'Consumer Rights' },
  { statement: 'Public universities must freeze tuition fees for three academic years following any year in which fees rose more than 5%.', category: 'Education' },
  { statement: 'Any government contract exceeding $1 million must undergo public tender with a minimum of three competing bids.', category: 'Governance' },
  { statement: 'Workers must be given at least two weeks written notice before any period of mandatory overtime exceeding 10 hours per week.', category: 'Labour' },
  { statement: 'Cities with populations exceeding 500,000 must maintain a continuous dedicated cycling lane on all primary arterial roads.', category: 'Transport' },
  { statement: 'All publicly traded companies must include at least two independent non-executive directors on their governing boards.', category: 'Economics' },
  { statement: 'Citizens shall have the right to request human review of any algorithmic decision affecting their access to public benefits.', category: 'Technology' },
  { statement: 'Healthcare providers must supply fully itemised billing documentation within 14 days of any procedure or consultation.', category: 'Health' },
  { statement: 'National referendums may be called by citizen petition with the verified support of 5% of eligible registered voters.', category: 'Democracy' },
  { statement: 'All new privately-owned passenger vehicles must achieve a minimum fuel efficiency of 60 miles per gallon from 2030 onwards.', category: 'Environment' },
  { statement: 'Employers must provide paid family leave of at least 12 weeks at full pay for all primary caregivers of newborns or newly adopted children.', category: 'Labour' },
  { statement: 'All government-owned buildings must achieve independently verified carbon neutrality by the year 2032.', category: 'Environment' },
  { statement: 'Citizens must be notified of any data breach affecting their personal information within 72 hours of the organisation discovering the breach.', category: 'Technology' },
  { statement: 'All public libraries must offer free internet access at a minimum download speed of 50 Mbps during all opening hours.', category: 'Education' },
]

// ─── Seeded daily selection ───────────────────────────────────────────────────

function dateHash(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const clone = [...arr]
  let h = dateHash(seed)
  function next() {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5
    return (h >>> 0) / 4294967296
  }
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

function pickDaily<T>(pool: T[], seed: string, count: number): T[] {
  if (pool.length <= count) return pool
  const start = dateHash(seed) % pool.length
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(start + i) % pool.length])
  }
  return result
}

// ─── GET /api/civic-imposter ──────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const date = new Date().toISOString().slice(0, 10)

    // Pull established laws (prefer ones with enough votes to be recognisable)
    const { data, error } = await supabase
      .from('laws')
      .select('id, statement, category, total_votes')
      .eq('is_active', true)
      .not('statement', 'is', null)
      .order('total_votes', { ascending: false })
      .limit(300)

    const pool = ((data ?? []) as Array<{ id: string; statement: string; category: string | null; total_votes: number | null }>)
      .filter((l) => l.statement && l.statement.length > 20)

    // If fewer than 5 real laws exist, fall back to topics with status='law'
    let realPool = pool
    if (realPool.length < 5) {
      const { data: topicData } = await supabase
        .from('topics')
        .select('id, statement, category, total_votes')
        .eq('status', 'law')
        .not('statement', 'is', null)
        .order('total_votes', { ascending: false })
        .limit(200)
      realPool = ((topicData ?? []) as typeof pool).filter((t) => t.statement && t.statement.length > 20)
    }

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Need exactly 5 real laws
    const real5 = pickDaily(realPool, date, 5)

    // Pick today's fake law
    const fakeIndex = dateHash(date) % FAKE_LAWS.length
    const fakeLaw = FAKE_LAWS[fakeIndex]

    // Build the 6-item array: 5 real + 1 fake
    const realLaws: ImposterLaw[] = real5.map((l) => ({
      id: l.id,
      statement: l.statement,
      category: l.category ?? null,
      is_fake: false,
    }))

    const fakeLawEntry: ImposterLaw = {
      id: 'fake',
      statement: fakeLaw.statement,
      category: fakeLaw.category,
      is_fake: true,
    }

    const combined = [...realLaws, fakeLawEntry]

    // Shuffle so the fake isn't always last
    const shuffled = seededShuffle(combined, date + '-imposter')

    const fakeIdx = shuffled.findIndex((l) => l.is_fake)

    return NextResponse.json({
      date,
      laws: shuffled,
      fake_index: fakeIdx,
    } satisfies ImposterPayload)

  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
