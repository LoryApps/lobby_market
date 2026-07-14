import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only elders and debators can answer
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, clout')
    .eq('id', user.id)
    .single()

  if (!profile || !['debator', 'troll_catcher', 'elder'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only Debators and Elders can answer written questions' }, { status: 403 })
  }

  const { id } = params
  const body = await request.json()
  const { answer_text } = body

  if (!answer_text || answer_text.trim().length < 20) {
    return NextResponse.json({ error: 'Answer must be at least 20 characters' }, { status: 400 })
  }
  if (answer_text.length > 2000) {
    return NextResponse.json({ error: 'Answer must be under 2000 characters' }, { status: 400 })
  }

  // Check question exists and is open
  const { data: question } = await supabase
    .from('civic_written_questions')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if (question.status !== 'open') {
    return NextResponse.json({ error: 'This question has already been answered or closed' }, { status: 400 })
  }

  // Insert answer (unique constraint enforces one answer per question)
  const { error: answerError } = await supabase
    .from('civic_written_answers')
    .insert({ question_id: id, answerer_id: user.id, answer_text: answer_text.trim() })

  if (answerError) return NextResponse.json({ error: answerError.message }, { status: 500 })

  // Mark question as answered
  await supabase
    .from('civic_written_questions')
    .update({ status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true }, { status: 201 })
}
