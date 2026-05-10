import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type ArgumentReactionType = 'insightful' | 'compelling' | 'balanced' | 'needs_evidence'

export interface ReactionCounts {
  insightful: number
  compelling: number
  balanced: number
  needs_evidence: number
}

export interface ArgumentReactionsResponse {
  counts: ReactionCounts
  userReaction: ArgumentReactionType | null
}

const VALID_REACTIONS: ArgumentReactionType[] = ['insightful', 'compelling', 'balanced', 'needs_evidence']

// GET /api/topics/[id]/arguments/[argId]/react
// Returns reaction counts + the authenticated user's current reaction (if any).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; argId: string } }
) {
  const supabase = await createClient()

  const [{ data: { user } }, { data: rows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('argument_reactions')
      .select('reaction, user_id')
      .eq('argument_id', params.argId),
  ])

  const all = rows ?? []
  const counts: ReactionCounts = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
  let userReaction: ArgumentReactionType | null = null

  for (const row of all) {
    const r = row.reaction as ArgumentReactionType
    if (r in counts) counts[r]++
    if (user && row.user_id === user.id) userReaction = r
  }

  return NextResponse.json({ counts, userReaction } satisfies ArgumentReactionsResponse)
}

// POST /api/topics/[id]/arguments/[argId]/react
// Body: { reaction: ArgumentReactionType }
// Toggles the reaction: if the user already has the same reaction, removes it.
// If they have a different reaction, replaces it. Returns updated counts + userReaction.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; argId: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reaction?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reaction = body.reaction as ArgumentReactionType
  if (!VALID_REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
  }

  // Verify argument exists in this topic
  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id')
    .eq('id', params.argId)
    .eq('topic_id', params.id)
    .maybeSingle()

  if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 })

  // Check existing reaction
  const { data: existing } = await supabase
    .from('argument_reactions')
    .select('id, reaction')
    .eq('argument_id', params.argId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.reaction === reaction) {
      // Same reaction → toggle off (delete)
      await supabase.from('argument_reactions').delete().eq('id', existing.id)
    } else {
      // Different reaction → update
      await supabase
        .from('argument_reactions')
        .update({ reaction })
        .eq('id', existing.id)
    }
  } else {
    // No existing reaction → insert
    await supabase.from('argument_reactions').insert({
      argument_id: params.argId,
      user_id: user.id,
      reaction,
    })
  }

  // Return updated state
  const { data: rows } = await supabase
    .from('argument_reactions')
    .select('reaction, user_id')
    .eq('argument_id', params.argId)

  const all = rows ?? []
  const counts: ReactionCounts = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
  let userReaction: ArgumentReactionType | null = null

  for (const row of all) {
    const r = row.reaction as ArgumentReactionType
    if (r in counts) counts[r]++
    if (row.user_id === user.id) userReaction = r
  }

  return NextResponse.json({ counts, userReaction } satisfies ArgumentReactionsResponse)
}
