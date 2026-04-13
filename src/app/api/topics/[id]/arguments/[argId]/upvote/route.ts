import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/topics/[id]/arguments/[argId]/upvote
// Toggles an upvote on an argument. Returns { upvoted: boolean, upvotes: number }.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; argId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the argument belongs to the specified topic
  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, user_id, upvotes')
    .eq('id', params.argId)
    .eq('topic_id', params.id)
    .single()

  if (!arg) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  // Users cannot upvote their own arguments
  if (arg.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot upvote your own argument' }, { status: 403 })
  }

  // Check if the user has already upvoted
  const { data: existing } = await supabase
    .from('topic_argument_votes')
    .select('argument_id')
    .eq('argument_id', params.argId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Toggle off — remove the upvote
    await supabase
      .from('topic_argument_votes')
      .delete()
      .eq('argument_id', params.argId)
      .eq('user_id', user.id)

    // Fetch updated count
    const { data: updated } = await supabase
      .from('topic_arguments')
      .select('upvotes')
      .eq('id', params.argId)
      .single()

    return NextResponse.json({ upvoted: false, upvotes: updated?.upvotes ?? 0 })
  } else {
    // Toggle on — add the upvote
    await supabase
      .from('topic_argument_votes')
      .insert({ argument_id: params.argId, user_id: user.id })

    // Fetch updated count
    const { data: updated } = await supabase
      .from('topic_arguments')
      .select('upvotes')
      .eq('id', params.argId)
      .single()

    return NextResponse.json({ upvoted: true, upvotes: updated?.upvotes ?? 0 })
  }
}
