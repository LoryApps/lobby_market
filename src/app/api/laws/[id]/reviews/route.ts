import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawReview {
  id: string
  law_id: string
  stars: number
  body: string | null
  helpful: number
  created_at: string
  updated_at: string
  user_marked_helpful: boolean
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ReviewsAggregate {
  total: number
  avg_stars: number
  distribution: Record<number, number>  // star -> count
}

export interface ReviewsResponse {
  reviews: LawReview[]
  aggregate: ReviewsAggregate
  own_review: LawReview | null
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
  } | null
}

// ─── GET /api/laws/[id]/reviews ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch law
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch reviews with author profiles
  const { data: reviewRows } = await supabase
    .from('law_reviews')
    .select(`
      id,
      law_id,
      stars,
      body,
      helpful,
      created_at,
      updated_at,
      user_id,
      profiles!law_reviews_user_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .eq('law_id', lawId)
    .order('helpful', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch user's helpful marks
  let helpfulSet = new Set<string>()
  if (user) {
    const { data: helpfulRows } = await supabase
      .from('law_review_helpful')
      .select('review_id')
      .eq('user_id', user.id)

    helpfulSet = new Set((helpfulRows ?? []).map((r) => r.review_id))
  }

  const reviews: LawReview[] = (reviewRows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id,
      law_id: r.law_id,
      stars: r.stars,
      body: r.body,
      helpful: r.helpful,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_marked_helpful: helpfulSet.has(r.id),
      author: profile
        ? {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
          }
        : null,
    }
  })

  // Aggregate
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let starSum = 0
  for (const r of reviews) {
    distribution[r.stars] = (distribution[r.stars] ?? 0) + 1
    starSum += r.stars
  }
  const total = reviews.length
  const avg_stars = total > 0 ? starSum / total : 0

  const own_review = user
    ? reviews.find((r) => r.author?.id === user.id) ?? null
    : null

  return NextResponse.json({
    reviews,
    aggregate: { total, avg_stars, distribution },
    own_review,
    law,
  } satisfies ReviewsResponse)
}

// ─── POST /api/laws/[id]/reviews — create or update review ───────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lawId = params.id
  const body = await req.json()
  const stars = Number(body.stars)
  const reviewBody: string | null = body.body?.trim() || null

  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be 1–5' }, { status: 400 })
  }
  if (reviewBody && reviewBody.length > 280) {
    return NextResponse.json({ error: 'Review must be ≤ 280 characters' }, { status: 400 })
  }

  // Verify law exists
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const { data: review, error } = await supabase
    .from('law_reviews')
    .upsert(
      {
        law_id: lawId,
        user_id: user.id,
        stars,
        body: reviewBody,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'law_id,user_id' }
    )
    .select('id, stars, body, helpful, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ review })
}

// ─── DELETE /api/laws/[id]/reviews — remove own review ───────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('law_reviews')
    .delete()
    .eq('law_id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
