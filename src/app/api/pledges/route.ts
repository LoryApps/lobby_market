import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PledgeAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface Pledge {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string
  target_count: number | null
  current_count: number
  status: string
  is_public: boolean
  deadline: string | null
  completed_at: string | null
  witness_count: number
  created_at: string
  updated_at: string
  author: PledgeAuthor | null
  viewer_is_witness: boolean
}

export interface PledgesResponse {
  pledges: Pledge[]
  total: number
  stats: {
    total_active: number
    total_completed: number
    total_witnesses: number
  }
}

const VALID_CATEGORIES = [
  'participation',
  'advocacy',
  'debate',
  'research',
  'community',
  'accountability',
]
const VALID_SORTS = ['witnesses', 'newest', 'deadline', 'progress']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const category = searchParams.get('category') || null
  const sort = searchParams.get('sort') || 'witnesses'
  const status = searchParams.get('status') || 'active'
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 60)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Build query ─────────────────────────────────────────────────────────────
  let query = supabase
    .from('civic_pledges')
    .select(
      `id, user_id, title, description, category, target_count, current_count,
       status, is_public, deadline, completed_at, witness_count, created_at, updated_at,
       author:profiles!user_id(id, username, display_name, avatar_url, role)`,
      { count: 'exact' }
    )
    .eq('is_public', true)

  if (category && VALID_CATEGORIES.includes(category)) {
    query = query.eq('category', category)
  }

  if (status === 'active' || status === 'completed' || status === 'abandoned') {
    query = query.eq('status', status)
  }

  // Sort
  if (!VALID_SORTS.includes(sort)) {
    return NextResponse.json({ error: 'Invalid sort' }, { status: 400 })
  }
  if (sort === 'witnesses') {
    query = query.order('witness_count', { ascending: false }).order('created_at', { ascending: false })
  } else if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'deadline') {
    query = query.not('deadline', 'is', null).order('deadline', { ascending: true })
  } else if (sort === 'progress') {
    query = query.not('target_count', 'is', null).order('current_count', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Viewer witness set ───────────────────────────────────────────────────────
  let witnessedIds = new Set<string>()
  if (user && data && data.length > 0) {
    const pledgeIds = data.map((p) => p.id)
    const { data: witnesses } = await supabase
      .from('pledge_witnesses')
      .select('pledge_id')
      .eq('user_id', user.id)
      .in('pledge_id', pledgeIds)
    witnessedIds = new Set((witnesses ?? []).map((w) => w.pledge_id))
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const { data: statsRows } = await supabase
    .from('civic_pledges')
    .select('status, witness_count')
    .eq('is_public', true)

  const stats = (statsRows ?? []).reduce(
    (acc, row) => {
      if (row.status === 'active') acc.total_active++
      if (row.status === 'completed') acc.total_completed++
      acc.total_witnesses += row.witness_count as number
      return acc
    },
    { total_active: 0, total_completed: 0, total_witnesses: 0 }
  )

  const pledges: Pledge[] = (data ?? []).map((row) => ({
    ...row,
    author: Array.isArray(row.author) ? row.author[0] ?? null : (row.author as PledgeAuthor | null),
    viewer_is_witness: witnessedIds.has(row.id),
  }))

  return NextResponse.json({
    pledges,
    total: count ?? 0,
    stats,
  } satisfies PledgesResponse)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    title?: string
    description?: string
    category?: string
    target_count?: number | null
    deadline?: string | null
    is_public?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, description, category, target_count, deadline, is_public } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (title.trim().length > 200) {
    return NextResponse.json({ error: 'Title too long (max 200 chars)' }, { status: 400 })
  }
  if (description && description.length > 1000) {
    return NextResponse.json({ error: 'Description too long (max 1000 chars)' }, { status: 400 })
  }

  const cat = category && VALID_CATEGORIES.includes(category) ? category : 'participation'

  const { data, error } = await supabase
    .from('civic_pledges')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      category: cat,
      target_count: target_count ?? null,
      deadline: deadline ?? null,
      is_public: is_public !== false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pledge: data }, { status: 201 })
}
