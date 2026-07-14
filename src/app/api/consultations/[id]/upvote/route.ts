import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/consultations/[id]/upvote?responseId=<uuid>  — upvote a response
// DELETE same — remove upvote

export async function POST(
  request: NextRequest,
  _ctx: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const responseId = request.nextUrl.searchParams.get('responseId')
  if (!responseId) {
    return NextResponse.json({ error: 'responseId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('civic_consultation_response_upvotes')
    .insert({ response_id: responseId, user_id: user.id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  _ctx: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const responseId = request.nextUrl.searchParams.get('responseId')
  if (!responseId) {
    return NextResponse.json({ error: 'responseId required' }, { status: 400 })
  }

  await supabase
    .from('civic_consultation_response_upvotes')
    .delete()
    .eq('response_id', responseId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
