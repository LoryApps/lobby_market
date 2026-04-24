import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_REACTIONS = ['insightful', 'controversial', 'complex', 'surprising'] as const
type ReactionType = (typeof VALID_REACTIONS)[number]

function isReaction(v: unknown): v is ReactionType {
  return typeof v === 'string' && (VALID_REACTIONS as readonly string[]).includes(v)
}

interface ReactionRow {
  reaction: string
  count: number
}

// GET /api/topics/[id]/reactions
// Returns counts per reaction type and the current user's reaction (if any).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Aggregate counts
  const { data: rows, error } = await supabase
    .from('topic_reactions')
    .select('reaction')
    .eq('topic_id', topicId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build counts map
  const counts: Record<string, number> = {}
  for (const r of VALID_REACTIONS) counts[r] = 0
  for (const row of (rows as ReactionRow[] | null) ?? []) {
    if (isReaction(row.reaction)) counts[row.reaction]++
  }

  // Current user's reaction
  const { data: { user } } = await supabase.auth.getUser()
  let myReaction: string | null = null

  if (user) {
    const { data: mine } = await supabase
      .from('topic_reactions')
      .select('reaction')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .maybeSingle()
    myReaction = mine?.reaction ?? null
  }

  return NextResponse.json({ counts, myReaction })
}

// POST /api/topics/[id]/reactions
// Body: { reaction: ReactionType }
// Upserts the current user's reaction. If reaction === myReaction, removes it (toggle off).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { reaction?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isReaction(body.reaction)) {
    return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
  }

  const topicId = params.id

  // Check if user already has this exact reaction (toggle off)
  const { data: existing } = await supabase
    .from('topic_reactions')
    .select('id, reaction')
    .eq('topic_id', topicId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing && existing.reaction === body.reaction) {
    // Toggle off — delete
    await supabase
      .from('topic_reactions')
      .delete()
      .eq('topic_id', topicId)
      .eq('user_id', user.id)

    const counts = await fetchCounts(supabase, topicId)
    return NextResponse.json({ counts, myReaction: null })
  }

  // Upsert (insert or update)
  const { error } = await supabase
    .from('topic_reactions')
    .upsert(
      { topic_id: topicId, user_id: user.id, reaction: body.reaction },
      { onConflict: 'topic_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts = await fetchCounts(supabase, topicId)
  return NextResponse.json({ counts, myReaction: body.reaction })
}

async function fetchCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  topicId: string
): Promise<Record<string, number>> {
  const { data: rows } = await supabase
    .from('topic_reactions')
    .select('reaction')
    .eq('topic_id', topicId)

  const counts: Record<string, number> = {}
  for (const r of VALID_REACTIONS) counts[r] = 0
  for (const row of (rows as ReactionRow[] | null) ?? []) {
    if (isReaction(row.reaction)) counts[row.reaction]++
  }
  return counts
}
