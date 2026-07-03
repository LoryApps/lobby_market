import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/topics/[id]/questions/[qid]/vote — toggle upvote on a question

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { qid } = params

    // Check if already voted
    const { data: existing } = await supabase
      .from('topic_question_votes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('question_id', qid)
      .maybeSingle()

    if (existing) {
      // Unvote
      await supabase
        .from('topic_question_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('question_id', qid)

      await supabase.rpc('decrement_question_upvote', { q_id: qid }).maybeSingle().catch(() => {
        supabase.from('topic_questions').update({ upvotes: 0 }).eq('id', qid)
      })

      // Fallback: manually decrement
      const { data: q } = await supabase.from('topic_questions').select('upvotes').eq('id', qid).single()
      if (q) {
        await supabase.from('topic_questions').update({ upvotes: Math.max(0, q.upvotes - 1) }).eq('id', qid)
      }

      return NextResponse.json({ voted: false })
    } else {
      // Vote
      await supabase.from('topic_question_votes').insert({ user_id: user.id, question_id: qid })

      const { data: q } = await supabase.from('topic_questions').select('upvotes').eq('id', qid).single()
      if (q) {
        await supabase.from('topic_questions').update({ upvotes: q.upvotes + 1 }).eq('id', qid)
      }

      return NextResponse.json({ voted: true })
    }
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
