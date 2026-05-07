import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — toggle upvote on a piece of evidence
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; evidenceId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the evidence belongs to this topic
    const { data: evidence } = await supabase
      .from('topic_evidence')
      .select('id, topic_id, user_id')
      .eq('id', params.evidenceId)
      .eq('topic_id', params.id)
      .maybeSingle()

    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    // Can't vote on your own submission
    if (evidence.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot vote on your own submission' }, { status: 400 })
    }

    // Check for existing vote
    const { data: existing } = await supabase
      .from('topic_evidence_votes')
      .select('evidence_id')
      .eq('evidence_id', params.evidenceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Remove vote
      await supabase
        .from('topic_evidence_votes')
        .delete()
        .eq('evidence_id', params.evidenceId)
        .eq('user_id', user.id)

      // Get updated count
      const { data: updated } = await supabase
        .from('topic_evidence')
        .select('upvotes')
        .eq('id', params.evidenceId)
        .single()

      return NextResponse.json({ voted: false, upvotes: updated?.upvotes ?? 0 })
    } else {
      // Add vote
      await supabase
        .from('topic_evidence_votes')
        .insert({ evidence_id: params.evidenceId, user_id: user.id })

      const { data: updated } = await supabase
        .from('topic_evidence')
        .select('upvotes')
        .eq('id', params.evidenceId)
        .single()

      return NextResponse.json({ voted: true, upvotes: updated?.upvotes ?? 0 })
    }
  } catch (err) {
    console.error('[evidence vote]', err)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}

// DELETE — remove a user's own evidence submission
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; evidenceId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('topic_evidence')
      .delete()
      .eq('id', params.evidenceId)
      .eq('topic_id', params.id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[evidence delete]', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
