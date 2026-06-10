import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/laws/[id]/blueprint/notes/[noteId]/upvote ─────────────────────
// Toggle upvote on a blueprint note. Returns { upvotes, has_upvoted }.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to upvote' }, { status: 401 })
  }

  // Verify note belongs to this law
  const { data: note } = await supabase
    .from('blueprint_notes')
    .select('id, law_id, user_id, upvotes')
    .eq('id', params.noteId)
    .eq('law_id', params.id)
    .maybeSingle()

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  // Can't upvote own note
  if (note.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot upvote your own note' }, { status: 400 })
  }

  // Check if already upvoted
  const { data: existing } = await supabase
    .from('blueprint_note_upvotes')
    .select('note_id')
    .eq('note_id', params.noteId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove upvote
    await supabase
      .from('blueprint_note_upvotes')
      .delete()
      .eq('note_id', params.noteId)
      .eq('user_id', user.id)

    const { data: updated } = await supabase
      .from('blueprint_notes')
      .select('upvotes')
      .eq('id', params.noteId)
      .single()

    return NextResponse.json({ upvotes: updated?.upvotes ?? 0, has_upvoted: false })
  } else {
    // Add upvote
    await supabase
      .from('blueprint_note_upvotes')
      .insert({ note_id: params.noteId, user_id: user.id })

    const { data: updated } = await supabase
      .from('blueprint_notes')
      .select('upvotes')
      .eq('id', params.noteId)
      .single()

    return NextResponse.json({ upvotes: updated?.upvotes ?? 0, has_upvoted: true })
  }
}
