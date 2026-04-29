import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChallengeProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface ChallengeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface ChallengeEntry {
  id: string
  challenger_id: string
  challenged_id: string
  topic_id: string
  message: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'
  debate_id: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
  challenger: ChallengeProfile
  challenged: ChallengeProfile
  topic: ChallengeTopic
}

export interface ChallengesResponse {
  received: ChallengeEntry[]
  sent: ChallengeEntry[]
  pending_received: number
}

// ─── GET /api/challenges ──────────────────────────────────────────────────────
// Returns challenges received and sent by the current user.

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Mark expired pending challenges
  await supabase
    .from('debate_challenges')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  const [receivedResult, sentResult] = await Promise.all([
    supabase
      .from('debate_challenges')
      .select(`
        id, challenger_id, challenged_id, topic_id,
        message, status, debate_id, created_at, expires_at, responded_at,
        challenger:profiles!debate_challenges_challenger_id_fkey(id, username, display_name, avatar_url, role),
        challenged:profiles!debate_challenges_challenged_id_fkey(id, username, display_name, avatar_url, role),
        topic:topics!debate_challenges_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)
      `)
      .eq('challenged_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('debate_challenges')
      .select(`
        id, challenger_id, challenged_id, topic_id,
        message, status, debate_id, created_at, expires_at, responded_at,
        challenger:profiles!debate_challenges_challenger_id_fkey(id, username, display_name, avatar_url, role),
        challenged:profiles!debate_challenges_challenged_id_fkey(id, username, display_name, avatar_url, role),
        topic:topics!debate_challenges_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)
      `)
      .eq('challenger_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const received = (receivedResult.data ?? []) as unknown as ChallengeEntry[]
  const sent = (sentResult.data ?? []) as unknown as ChallengeEntry[]
  const pending_received = received.filter((c) => c.status === 'pending').length

  return NextResponse.json({ received, sent, pending_received } satisfies ChallengesResponse)
}

// ─── POST /api/challenges ─────────────────────────────────────────────────────
// Create a new challenge.

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { challenged_id?: string; topic_id?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { challenged_id, topic_id, message } = body

  if (!challenged_id || !topic_id) {
    return NextResponse.json({ error: 'challenged_id and topic_id are required' }, { status: 400 })
  }

  if (challenged_id === user.id) {
    return NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 })
  }

  if (message && message.length > 280) {
    return NextResponse.json({ error: 'Message must be 280 characters or fewer' }, { status: 400 })
  }

  // Verify topic and user exist
  const [topicResult, profileResult] = await Promise.all([
    supabase.from('topics').select('id, status').eq('id', topic_id).single(),
    supabase.from('profiles').select('id').eq('id', challenged_id).single(),
  ])

  if (!topicResult.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }
  if (!profileResult.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check for existing pending challenge between these users on this topic
  const { data: existing } = await supabase
    .from('debate_challenges')
    .select('id, status')
    .eq('challenger_id', user.id)
    .eq('challenged_id', challenged_id)
    .eq('topic_id', topic_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending challenge on this topic with this user' }, { status: 409 })
  }

  const { data: challenge, error } = await supabase
    .from('debate_challenges')
    .insert({
      challenger_id: user.id,
      challenged_id,
      topic_id,
      message: message?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(challenge, { status: 201 })
}
