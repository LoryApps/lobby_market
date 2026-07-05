import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if already voted
    const { data: existing } = await supabase
      .from('ama_question_votes')
      .select('user_id')
      .eq('question_id', params.qid)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Unvote
      await supabase
        .from('ama_question_votes')
        .delete()
        .eq('question_id', params.qid)
        .eq('user_id', user.id)
      await supabase
        .from('ama_questions')
        .update({ upvotes: (await supabase.from('ama_questions').select('upvotes').eq('id', params.qid).single()).data?.upvotes - 1 ?? 0 })
        .eq('id', params.qid)
      return NextResponse.json({ voted: false })
    }

    // Vote
    await supabase
      .from('ama_question_votes')
      .insert({ question_id: params.qid, user_id: user.id })

    const { data: q } = await supabase
      .from('ama_questions')
      .select('upvotes')
      .eq('id', params.qid)
      .single()

    await supabase
      .from('ama_questions')
      .update({ upvotes: (q?.upvotes ?? 0) + 1 })
      .eq('id', params.qid)

    return NextResponse.json({ voted: true })
  } catch (err) {
    console.error('AMA upvote error:', err)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
