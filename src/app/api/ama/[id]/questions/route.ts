import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session exists and is not ended/cancelled
    const { data: session } = await supabase
      .from('ama_sessions')
      .select('id, status')
      .eq('id', params.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.status === 'ended' || session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session is no longer accepting questions' }, { status: 400 })
    }

    const body = await req.json() as { content?: string }
    const content = body.content?.trim()

    if (!content || content.length < 10) {
      return NextResponse.json({ error: 'Question must be at least 10 characters' }, { status: 400 })
    }
    if (content.length > 300) {
      return NextResponse.json({ error: 'Question must be 300 characters or less' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('ama_questions')
      .insert({
        session_id: params.id,
        author_id: user.id,
        content,
      })
      .select()
      .single()

    if (error) throw error

    // Increment question_count
    await supabase.rpc('increment_ama_question_count' as never, { session_id_arg: params.id }).catch(() => {
      // best-effort; counter may drift slightly if RPC is missing
    })

    return NextResponse.json({ question }, { status: 201 })
  } catch (err) {
    console.error('AMA question submit error:', err)
    return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 })
  }
}
