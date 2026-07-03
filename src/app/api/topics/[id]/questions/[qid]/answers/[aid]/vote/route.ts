import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/topics/[id]/questions/[qid]/answers/[aid]/vote — add upvote
// DELETE same path — remove upvote

async function toggleVote(
  req: NextRequest,
  { params }: { params: { id: string; qid: string; aid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { aid } = params

    // Verify answer exists and belongs to this topic/question
    const { data: answer } = await supabase
      .from('topic_answers')
      .select('id, upvotes, author_id')
      .eq('id', aid)
      .eq('question_id', params.qid)
      .single()

    if (!answer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (answer.author_id === user.id) {
      return NextResponse.json({ error: 'Cannot vote on your own answer' }, { status: 403 })
    }

    const removing = req.method === 'DELETE'

    const { data: existing } = await supabase
      .from('topic_answer_votes')
      .select('answer_id')
      .eq('user_id', user.id)
      .eq('answer_id', aid)
      .maybeSingle()

    if (removing) {
      if (!existing) return NextResponse.json({ voted: false, upvotes: answer.upvotes })

      await supabase
        .from('topic_answer_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('answer_id', aid)

      const newCount = Math.max(0, answer.upvotes - 1)
      await supabase
        .from('topic_answers')
        .update({ upvotes: newCount })
        .eq('id', aid)

      return NextResponse.json({ voted: false, upvotes: newCount })
    } else {
      if (existing) return NextResponse.json({ voted: true, upvotes: answer.upvotes })

      await supabase
        .from('topic_answer_votes')
        .insert({ user_id: user.id, answer_id: aid })

      const newCount = answer.upvotes + 1
      await supabase
        .from('topic_answers')
        .update({ upvotes: newCount })
        .eq('id', aid)

      return NextResponse.json({ voted: true, upvotes: newCount })
    }
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export { toggleVote as POST, toggleVote as DELETE }
