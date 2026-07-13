import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ManifestoResult } from '@/app/api/manifesto/route'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ManifestoResult
  try {
    body = (await req.json()) as ManifestoResult
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.title || !body.archetype || !body.declaration) {
    return NextResponse.json({ error: 'Missing required manifesto fields' }, { status: 400 })
  }

  // Fetch username and display_name for denormalized storage
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.username) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Upsert: one manifesto per user, republish overwrites in place
  const { data, error } = await supabase
    .from('public_manifestos')
    .upsert(
      {
        user_id: user.id,
        username: profile.username,
        display_name: profile.display_name ?? null,
        title: body.title.slice(0, 200),
        archetype: body.archetype.slice(0, 100),
        archetype_description: body.archetype_description.slice(0, 500),
        declaration: body.declaration.slice(0, 1000),
        signoff: (body.signoff ?? '').slice(0, 300),
        sections: Array.isArray(body.sections) ? body.sections.slice(0, 8) : [],
        total_votes: body.stats?.total_votes ?? 0,
        categories_covered: body.stats?.categories_covered ?? 0,
        for_pct: body.stats?.for_pct ?? 50,
        laws_supported: body.stats?.laws_supported ?? 0,
        top_category: body.stats?.top_category ?? null,
        is_public: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Manifesto publish error:', error)
    return NextResponse.json({ error: 'Failed to publish manifesto' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, username: profile.username })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('public_manifestos')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
