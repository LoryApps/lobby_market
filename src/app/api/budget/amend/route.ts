import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — propose or upvote an amendment
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body as { action: 'propose' | 'upvote' }

  if (action === 'propose') {
    const { budget_id, category, proposed_pct, rationale } = body as {
      budget_id: string
      category: string
      proposed_pct: number
      rationale: string
    }

    if (!budget_id || !category || proposed_pct == null || !rationale) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data, error } = await supabase.from('civic_budget_amendments').insert({
      budget_id,
      proposed_by: user.id,
      category,
      proposed_pct,
      rationale,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (action === 'upvote') {
    const { amendment_id } = body as { amendment_id: string }
    if (!amendment_id) return NextResponse.json({ error: 'Missing amendment_id' }, { status: 400 })

    const { error } = await supabase.from('civic_budget_amendment_votes').insert({
      amendment_id,
      user_id: user.id,
    })

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already upvoted' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
