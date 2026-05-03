import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_ARCHETYPES = new Set([
  'pragmatist', 'idealist', 'guardian', 'reformer',
  'libertarian', 'communitarian', 'technocrat', 'democrat',
])

// GET /api/profile/archetype — return the current user's saved archetype
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ archetype: null })
  }

  const { data } = await supabase
    .from('profiles')
    .select('civic_archetype, archetype_set_at')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    archetype: data?.civic_archetype ?? null,
    set_at: data?.archetype_set_at ?? null,
  })
}

// POST /api/profile/archetype — save the quiz result to the user's profile
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { archetype?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const archetype = body.archetype?.trim()
  if (!archetype || !VALID_ARCHETYPES.has(archetype)) {
    return NextResponse.json({ error: 'Invalid archetype' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ civic_archetype: archetype, archetype_set_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save archetype' }, { status: 500 })
  }

  return NextResponse.json({ archetype, saved: true })
}
