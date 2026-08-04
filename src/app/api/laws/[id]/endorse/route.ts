import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EndorserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
}

export interface EndorsementItem {
  id: string
  user_id: string
  message: string | null
  created_at: string
  author: EndorserProfile | null
}

export interface LawEndorseData {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string | null
  endorsement_count: number
  endorsements: EndorsementItem[]
  user_endorsement: EndorsementItem | null
}

// ─── GET /api/laws/[id]/endorse ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [lawResult, endorsementsResult] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('law_endorsements')
      .select('id, user_id, message, created_at')
      .eq('law_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (lawResult.error || !lawResult.data) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const law = lawResult.data
  const rawEndorsements = endorsementsResult.data ?? []

  // Fetch author profiles
  const userIds = [...new Set(rawEndorsements.map((e) => e.user_id))]
  let profileMap: Record<string, EndorserProfile> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout')
      .in('id', userIds)

    for (const p of profiles ?? []) {
      profileMap[p.id] = p as EndorserProfile
    }
  }

  const endorsements: EndorsementItem[] = rawEndorsements.map((e) => ({
    id: e.id,
    user_id: e.user_id,
    message: e.message,
    created_at: e.created_at,
    author: profileMap[e.user_id] ?? null,
  }))

  const userEndorsement = user
    ? endorsements.find((e) => e.user_id === user.id) ?? null
    : null

  return NextResponse.json({
    law_id: law.id,
    law_statement: law.statement,
    law_category: law.category,
    law_blue_pct: law.blue_pct,
    law_total_votes: law.total_votes,
    law_established_at: law.established_at,
    endorsement_count: rawEndorsements.length,
    endorsements,
    user_endorsement: userEndorsement,
  } satisfies LawEndorseData)
}

// ─── POST /api/laws/[id]/endorse ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const message: string | null = typeof body.message === 'string' && body.message.trim().length > 0
    ? body.message.trim().slice(0, 280)
    : null

  const { data, error } = await supabase
    .from('law_endorsements')
    .insert({ law_id: params.id, user_id: user.id, message })
    .select('id, user_id, message, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already endorsed' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    ...data,
    author: profile ?? null,
  } satisfies EndorsementItem, { status: 201 })
}

// ─── DELETE /api/laws/[id]/endorse ───────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('law_endorsements')
    .delete()
    .eq('law_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
