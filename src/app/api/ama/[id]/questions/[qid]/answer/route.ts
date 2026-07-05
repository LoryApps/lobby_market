import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session and that caller is the host
    const { data: session } = await supabase
      .from('ama_sessions')
      .select('id, host_id, status')
      .eq('id', params.id)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.host_id !== user.id) {
      return NextResponse.json({ error: 'Only the session host can answer questions' }, { status: 403 })
    }
    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session is cancelled' }, { status: 400 })
    }

    const body = await req.json() as { content?: string }
    const content = body.content?.trim()

    if (!content || content.length < 10) {
      return NextResponse.json({ error: 'Answer must be at least 10 characters' }, { status: 400 })
    }

    // Upsert the answer (host can edit their answer)
    const { data: answer, error } = await supabase
      .from('ama_answers')
      .upsert(
        {
          question_id: params.qid,
          session_id: params.id,
          host_id: user.id,
          content: content.slice(0, 1200),
        },
        { onConflict: 'question_id' }
      )
      .select()
      .single()

    if (error) throw error

    // Mark question as answered
    await supabase
      .from('ama_questions')
      .update({ is_answered: true })
      .eq('id', params.qid)

    return NextResponse.json({ answer }, { status: 201 })
  } catch (err) {
    console.error('AMA answer error:', err)
    return NextResponse.json({ error: 'Failed to post answer' }, { status: 500 })
  }
}
