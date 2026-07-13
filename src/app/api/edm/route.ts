import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EDMAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface EDM {
  id: string
  filed_by: string
  title: string
  body: string
  category: string
  grounds: string
  second_count: number
  status: string
  expires_at: string
  created_at: string
  topic_id: string | null
  author: EDMAuthor | null
  user_seconded?: boolean
}

export interface EDMListResponse {
  edms: EDM[]
  total: number
}

export interface EDMCreateRequest {
  title: string
  body: string
  category: string
  grounds: string
  topic_id?: string | null
}

// ── Grounds config ─────────────────────────────────────────────────────────────

const VALID_GROUNDS = [
  'commendation',
  'concern',
  'opposition',
  'call_to_action',
  'information',
] as const

const VALID_CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Education', 'Environment', 'Other',
] as const

// ── GET /api/edm ───────────────────────────────────────────────────────────────
// Returns paginated EDMs with optional filters.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams

  const category  = sp.get('category') ?? null
  const grounds   = sp.get('grounds') ?? null
  const sort      = sp.get('sort') ?? 'recent'   // 'recent' | 'popular'
  const status    = sp.get('status') ?? 'open'
  const limit     = Math.min(Number(sp.get('limit') ?? 20), 50)
  const offset    = Number(sp.get('offset') ?? 0)

  // Get current user to flag user_seconded
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('early_day_motions')
    .select(`
      *,
      author:profiles!early_day_motions_filed_by_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `, { count: 'exact' })
    .eq('status', status)

  if (category) query = query.eq('category', category)
  if (grounds)  query = query.eq('grounds', grounds)

  if (sort === 'popular') {
    query = query.order('second_count', { ascending: false })
               .order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If authenticated, fetch which EDMs the user has seconded
  let secondedIds = new Set<string>()
  if (user && data && data.length > 0) {
    const ids = data.map((e) => e.id)
    const { data: seconds } = await supabase
      .from('edm_seconds')
      .select('edm_id')
      .eq('user_id', user.id)
      .in('edm_id', ids)
    secondedIds = new Set((seconds ?? []).map((s) => s.edm_id))
  }

  const edms: EDM[] = (data ?? []).map((row) => ({
    ...row,
    author: row.author as EDMAuthor | null,
    user_seconded: secondedIds.has(row.id),
  }))

  return NextResponse.json({ edms, total: count ?? 0 } satisfies EDMListResponse)
}

// ── POST /api/edm ──────────────────────────────────────────────────────────────
// File a new EDM. Requires authentication.

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: EDMCreateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, body: text, category, grounds, topic_id } = body

  // Validate
  if (!title || title.length < 10 || title.length > 120) {
    return NextResponse.json({ error: 'Title must be 10–120 characters' }, { status: 400 })
  }
  if (!text || text.length < 30 || text.length > 1000) {
    return NextResponse.json({ error: 'Body must be 30–1000 characters' }, { status: 400 })
  }
  if (!VALID_GROUNDS.includes(grounds as typeof VALID_GROUNDS[number])) {
    return NextResponse.json({ error: 'Invalid grounds' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const { data: edm, error } = await supabase
    .from('early_day_motions')
    .insert({
      filed_by: user.id,
      title:    title.trim(),
      body:     text.trim(),
      category,
      grounds,
      topic_id: topic_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ edm }, { status: 201 })
}
