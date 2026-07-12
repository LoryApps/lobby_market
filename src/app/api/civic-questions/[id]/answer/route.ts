import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // Verify the question exists and this user is the minister
  const { data: question, error: qErr } = await supabase
    .from('civic_minister_questions')
    .select('id, minister_id, status')
    .eq('id', id)
    .maybeSingle()

  if (qErr || !question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if (question.minister_id !== user.id) {
    return NextResponse.json({ error: 'Only the addressed minister can answer' }, { status: 403 })
  }
  if (question.status === 'answered') {
    return NextResponse.json({ error: 'Already answered' }, { status: 409 })
  }

  const body = await req.json() as { answer_text: string; topic_links?: string[] }
  const { answer_text, topic_links = [] } = body

  if (!answer_text || answer_text.trim().length < 10) {
    return NextResponse.json({ error: 'Answer must be at least 10 characters' }, { status: 400 })
  }
  if (answer_text.trim().length > 1000) {
    return NextResponse.json({ error: 'Answer must be at most 1000 characters' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_minister_answers')
    .insert({
      question_id: id,
      minister_id: user.id,
      answer_text: answer_text.trim(),
      topic_links: topic_links.slice(0, 5),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
