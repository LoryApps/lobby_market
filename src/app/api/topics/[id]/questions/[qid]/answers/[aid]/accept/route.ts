import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/topics/[id]/questions/[qid]/answers/[aid]/accept
// Toggles is_accepted on the answer. Only the question's author may call this.
// Accepting this answer un-accepts any other answer for the same question.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; qid: string; aid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { qid, aid } = params

    // Verify caller is the question author
    const { data: question } = await supabase
      .from('topic_questions')
      .select('author_id')
      .eq('id', qid)
      .single()

    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    if (question.author_id !== user.id) {
      return NextResponse.json({ error: 'Only the question author may accept an answer' }, { status: 403 })
    }

    // Get the current accepted state of this answer
    const { data: answer } = await supabase
      .from('topic_answers')
      .select('id, is_accepted')
      .eq('id', aid)
      .eq('question_id', qid)
      .single()

    if (!answer) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })

    const accepting = !answer.is_accepted

    if (accepting) {
      // Un-accept any previously accepted answer for this question
      await supabase
        .from('topic_answers')
        .update({ is_accepted: false })
        .eq('question_id', qid)
        .eq('is_accepted', true)

      // Accept this answer
      await supabase
        .from('topic_answers')
        .update({ is_accepted: true })
        .eq('id', aid)
    } else {
      // Toggle off — un-accept
      await supabase
        .from('topic_answers')
        .update({ is_accepted: false })
        .eq('id', aid)
    }

    return NextResponse.json({ accepted: accepting })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
