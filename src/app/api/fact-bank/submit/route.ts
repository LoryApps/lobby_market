import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Environment', 'Education', 'General',
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    claim?: string
    category?: string
    source_url?: string
    source_title?: string
    context?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const claim = (body.claim ?? '').trim()
  if (!claim || claim.length < 10 || claim.length > 500) {
    return NextResponse.json({ error: 'Claim must be 10–500 characters' }, { status: 400 })
  }

  const category = CATEGORIES.includes(body.category ?? '') ? (body.category ?? 'General') : 'General'
  const source_url   = (body.source_url   ?? '').trim() || null
  const source_title = (body.source_title ?? '').trim() || null
  const context      = (body.context      ?? '').trim().slice(0, 1000) || null

  const { data, error } = await supabase
    .from('civic_facts')
    .insert({
      author_id:    user.id,
      claim,
      category,
      source_url,
      source_title,
      context,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[fact-bank/submit]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
