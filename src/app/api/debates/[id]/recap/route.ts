import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // Top arguments (is_argument=true, ordered by upvotes)
  const { data: topArguments } = await supabase
    .from('debate_messages')
    .select('id, content, side, upvotes, user_id')
    .eq('debate_id', id)
    .eq('is_argument', true)
    .order('upvotes', { ascending: false })
    .limit(5)

  // All messages for side-breakdown
  const { data: allMessages } = await supabase
    .from('debate_messages')
    .select('id, side')
    .eq('debate_id', id)

  // Reactions for emoji counts
  const { data: reactions } = await supabase
    .from('debate_reactions')
    .select('emoji')
    .eq('debate_id', id)

  // Hydrate author profiles for top arguments
  const authorIds = Array.from(
    new Set((topArguments ?? []).map((m) => m.user_id))
  )
  const profileMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', authorIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }
    }
  }

  const topMessages = (topArguments ?? []).map((m) => ({
    ...m,
    author: profileMap[m.user_id] ?? null,
  }))

  // Count reactions by emoji
  const reactionCounts: Record<string, number> = {}
  for (const r of reactions ?? []) {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1
  }

  // Message stats per side
  const msgs = allMessages ?? []
  const messageStats = {
    blue: msgs.filter((m) => m.side === 'blue').length,
    red: msgs.filter((m) => m.side === 'red').length,
    neutral: msgs.filter((m) => !m.side).length,
    total: msgs.length,
  }

  return NextResponse.json({
    topMessages,
    reactionCounts,
    messageStats,
  })
}
