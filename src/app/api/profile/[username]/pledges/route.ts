import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // ── Resolve profile ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Current viewer ──────────────────────────────────────────────────────
  const { data: { user: viewer } } = await supabase.auth.getUser()
  const isOwner = viewer?.id === profile.id

  // ── Fetch public pledges ─────────────────────────────────────────────────
  const { data: rows } = await supabase
    .from('civic_pledges')
    .select(
      'id, title, description, category, status, target_count, current_count, witness_count, deadline, completed_at, created_at, is_public'
    )
    .eq('user_id', profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  const pledgeRows = (rows ?? []) as Array<{
    id: string
    title: string
    description: string | null
    category: string
    status: string
    target_count: number | null
    current_count: number
    witness_count: number
    deadline: string | null
    completed_at: string | null
    created_at: string
    is_public: boolean
  }>

  // ── Viewer witness status ────────────────────────────────────────────────
  let witnessedIds = new Set<string>()
  if (viewer && pledgeRows.length > 0) {
    const pledgeIds = pledgeRows.map((p) => p.id)
    const { data: witnesses } = await supabase
      .from('pledge_witnesses')
      .select('pledge_id')
      .eq('user_id', viewer.id)
      .in('pledge_id', pledgeIds)
    witnessedIds = new Set((witnesses ?? []).map((w: { pledge_id: string }) => w.pledge_id))
  }

  // ── Build response ───────────────────────────────────────────────────────
  const pledges = pledgeRows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    status: p.status,
    target_count: p.target_count,
    current_count: p.current_count,
    witness_count: p.witness_count,
    deadline: p.deadline,
    completed_at: p.completed_at,
    created_at: p.created_at,
    viewer_is_witness: witnessedIds.has(p.id),
  }))

  const stats = {
    total: pledges.length,
    active: pledges.filter((p) => p.status === 'active').length,
    completed: pledges.filter((p) => p.status === 'completed').length,
    abandoned: pledges.filter((p) => p.status === 'abandoned').length,
    total_witnesses: pledges.reduce((sum, p) => sum + p.witness_count, 0),
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    },
    pledges,
    is_own_profile: isOwner,
    stats,
  })
}
