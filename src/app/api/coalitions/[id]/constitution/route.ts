import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConstitutionRevision {
  id: string
  author_id: string
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  edit_summary: string | null
  created_at: string
}

export interface ConstitutionResponse {
  coalition: {
    id: string
    name: string
    creator_id: string
    constitution_md: string | null
    constitution_updated_at: string | null
    constitution_updated_by: string | null
    updater_username: string | null
    updater_display_name: string | null
  }
  revisions: ConstitutionRevision[]
  is_leader: boolean
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: coalition, error } = await supabase
    .from('coalitions')
    .select(`
      id, name, creator_id,
      constitution_md, constitution_updated_at, constitution_updated_by
    `)
    .eq('id', params.id)
    .single()

  if (error || !coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // Fetch updater profile if we have one
  let updaterUsername: string | null = null
  let updaterDisplayName: string | null = null
  if (coalition.constitution_updated_by) {
    const { data: updater } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', coalition.constitution_updated_by)
      .single()
    updaterUsername = updater?.username ?? null
    updaterDisplayName = updater?.display_name ?? null
  }

  // Fetch revision history (last 20)
  const { data: rawRevisions } = await supabase
    .from('coalition_constitution_revisions')
    .select(`
      id, author_id, edit_summary, created_at,
      profiles:author_id ( username, display_name, avatar_url )
    `)
    .eq('coalition_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const revisions: ConstitutionRevision[] = (rawRevisions ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id,
      author_id: r.author_id,
      author_username: (profile as { username?: string | null } | null)?.username ?? null,
      author_display_name: (profile as { display_name?: string | null } | null)?.display_name ?? null,
      author_avatar_url: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      edit_summary: r.edit_summary,
      created_at: r.created_at,
    }
  })

  // Check if current user is a leader
  const { data: { user } } = await supabase.auth.getUser()
  let is_leader = false
  if (user) {
    const { data: member } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', params.id)
      .eq('user_id', user.id)
      .single()
    is_leader =
      coalition.creator_id === user.id ||
      (member?.role === 'officer') ||
      (member?.role === 'leader')
  }

  const payload: ConstitutionResponse = {
    coalition: {
      id: coalition.id,
      name: coalition.name,
      creator_id: coalition.creator_id,
      constitution_md: coalition.constitution_md,
      constitution_updated_at: coalition.constitution_updated_at,
      constitution_updated_by: coalition.constitution_updated_by,
      updater_username: updaterUsername,
      updater_display_name: updaterDisplayName,
    },
    revisions,
    is_leader,
  }

  return NextResponse.json(payload)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Verify leader/officer
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, creator_id')
    .eq('id', params.id)
    .single()

  if (!coalition) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .single()

  const isLeader =
    coalition.creator_id === user.id ||
    member?.role === 'officer' ||
    member?.role === 'leader'

  if (!isLeader) {
    return NextResponse.json({ error: 'Only coalition leaders can edit the constitution' }, { status: 403 })
  }

  const body = await req.json() as { constitution_md: string; edit_summary?: string }
  const { constitution_md, edit_summary } = body

  if (typeof constitution_md !== 'string') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (constitution_md.length > 50_000) {
    return NextResponse.json({ error: 'Constitution exceeds 50,000 character limit' }, { status: 400 })
  }

  // Save revision
  await supabase.from('coalition_constitution_revisions').insert({
    coalition_id: params.id,
    author_id: user.id,
    body_md: constitution_md,
    edit_summary: edit_summary?.slice(0, 200) ?? null,
  })

  // Update coalition
  const { error: updateErr } = await supabase
    .from('coalitions')
    .update({
      constitution_md,
      constitution_updated_at: new Date().toISOString(),
      constitution_updated_by: user.id,
    })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
