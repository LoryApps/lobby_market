import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectionCoalition {
  coalition_id: string
  name: string
  member_count: number
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  declared_at: string
}

export interface ConnectionTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  category: string | null
}

export interface ConnectionLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  shared_reason: 'category' | 'keyword'
}

export interface ConnectionDebate {
  id: string
  title: string
  type: string
  status: string
  scheduled_at: string | null
  viewer_count: number
  participant_count: number
}

export interface LawConnectionsResponse {
  law: {
    id: string
    topic_id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  coalitions: {
    for: ConnectionCoalition[]
    against: ConnectionCoalition[]
    neutral: ConnectionCoalition[]
    total: number
  }
  activeSisterDebates: ConnectionTopic[]
  relatedLaws: ConnectionLaw[]
  debates: ConnectionDebate[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MIN_WORD_LEN = 5
const STOPWORDS = new Set([
  'should', 'could', 'would', 'their', 'there', 'these', 'those', 'about',
  'above', 'after', 'again', 'being', 'below', 'between', 'both', 'cannot',
  'does', 'during', 'every', 'from', 'further', 'have', 'here', 'itself',
  'just', 'more', 'most', 'must', 'need', 'never', 'only', 'other', 'over',
  'same', 'since', 'some', 'still', 'such', 'than', 'that', 'them', 'then',
  'through', 'under', 'until', 'were', 'what', 'when', 'where', 'which',
  'while', 'with', 'within', 'without', 'your',
])

function extractKeywords(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w))
    .slice(0, 8)
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Fetch the law
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Run all queries in parallel
  const [
    stancesResult,
    sisterResult,
    relatedLawsResult,
    debatesResult,
  ] = await Promise.all([

    // 2. Coalition stances on this law's source topic
    law.topic_id
      ? supabase
          .from('coalition_stances')
          .select(`
            stance,
            statement,
            created_at,
            coalitions!inner (
              id,
              name,
              member_count,
              is_public
            )
          `)
          .eq('topic_id', law.topic_id)
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    // 3. Active / voting sister debates in the same category
    law.category
      ? supabase
          .from('topics')
          .select('id, statement, status, blue_pct, total_votes, category')
          .eq('category', law.category)
          .in('status', ['active', 'voting'])
          .order('total_votes', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),

    // 4. Related laws in the same category (excluding this one)
    law.category
      ? supabase
          .from('laws')
          .select('id, statement, category, blue_pct, total_votes, established_at')
          .eq('category', law.category)
          .neq('id', law.id)
          .order('total_votes', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),

    // 5. Debates connected to this law's source topic
    law.topic_id
      ? supabase
          .from('debates')
          .select('id, title, type, status, scheduled_at, viewer_count')
          .eq('topic_id', law.topic_id)
          .order('scheduled_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
  ])

  // ── Process coalition stances ───────────────────────────────────────────────
  type StanceRow = {
    stance: string
    statement: string | null
    created_at: string
    coalitions: {
      id: string
      name: string
      member_count: number
      is_public: boolean
    }
  }

  const stanceRows = ((stancesResult.data ?? []) as unknown as StanceRow[]).filter(
    (s) => s.coalitions?.is_public
  )

  function toCoalition(s: StanceRow): ConnectionCoalition {
    return {
      coalition_id: s.coalitions.id,
      name: s.coalitions.name,
      member_count: s.coalitions.member_count ?? 0,
      stance: s.stance as 'for' | 'against' | 'neutral',
      statement: s.statement,
      declared_at: s.created_at,
    }
  }

  const coalitions = {
    for: stanceRows.filter((s) => s.stance === 'for').map(toCoalition),
    against: stanceRows.filter((s) => s.stance === 'against').map(toCoalition),
    neutral: stanceRows.filter((s) => s.stance === 'neutral').map(toCoalition),
    total: stanceRows.length,
  }

  // ── Active sister debates ───────────────────────────────────────────────────
  const activeSisterDebates: ConnectionTopic[] = (
    (sisterResult.data ?? []) as ConnectionTopic[]
  )

  // ── Related laws with keyword scoring ──────────────────────────────────────
  const keywords = extractKeywords(law.statement ?? '')
  type LawRow = {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  const relatedLaws: ConnectionLaw[] = ((relatedLawsResult.data ?? []) as LawRow[]).map(
    (l) => {
      const lawKeywords = extractKeywords(l.statement ?? '')
      const shared = lawKeywords.filter((k) => keywords.includes(k))
      return {
        ...l,
        shared_reason: shared.length > 0 ? ('keyword' as const) : ('category' as const),
      }
    }
  )

  // ── Debates ────────────────────────────────────────────────────────────────
  type DebateRow = {
    id: string
    title: string
    type: string
    status: string
    scheduled_at: string | null
    viewer_count: number
  }
  const debates: ConnectionDebate[] = ((debatesResult.data ?? []) as DebateRow[]).map(
    (d) => ({
      ...d,
      participant_count: 0,
    })
  )

  const response: LawConnectionsResponse = {
    law: {
      id: law.id,
      topic_id: law.topic_id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    coalitions,
    activeSisterDebates,
    relatedLaws,
    debates,
  }

  return NextResponse.json(response)
}
