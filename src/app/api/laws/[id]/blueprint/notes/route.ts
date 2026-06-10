import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NoteAspect = 'phase' | 'stakeholder' | 'challenge' | 'metric' | 'resource' | 'general'

export interface BlueprintNote {
  id: string
  law_id: string
  user_id: string
  content: string
  aspect: NoteAspect
  upvotes: number
  created_at: string
  has_upvoted: boolean
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface BlueprintNotesResponse {
  notes: BlueprintNote[]
  total: number
  user_note_count: number
}

// ─── GET /api/laws/[id]/blueprint/notes ──────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch notes with author profiles
  const { data: rows, error } = await supabase
    .from('blueprint_notes')
    .select(`
      id, law_id, user_id, content, aspect, upvotes, created_at,
      profiles:user_id ( username, display_name, avatar_url, role )
    `)
    .eq('law_id', lawId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch upvotes by current user (if logged in)
  let upvotedSet = new Set<string>()
  let userNoteCount = 0
  if (user) {
    const noteIds = (rows ?? []).map((r: { id: string }) => r.id)
    if (noteIds.length > 0) {
      const { data: uvRows } = await supabase
        .from('blueprint_note_upvotes')
        .select('note_id')
        .eq('user_id', user.id)
        .in('note_id', noteIds)
      upvotedSet = new Set((uvRows ?? []).map((r: { note_id: string }) => r.note_id))
    }

    const { count } = await supabase
      .from('blueprint_notes')
      .select('id', { count: 'exact', head: true })
      .eq('law_id', lawId)
      .eq('user_id', user.id)
    userNoteCount = count ?? 0
  }

  const notes: BlueprintNote[] = (rows ?? []).map((r: {
    id: string
    law_id: string
    user_id: string
    content: string
    aspect: NoteAspect
    upvotes: number
    created_at: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }) => ({
    id: r.id,
    law_id: r.law_id,
    user_id: r.user_id,
    content: r.content,
    aspect: r.aspect,
    upvotes: r.upvotes,
    created_at: r.created_at,
    has_upvoted: upvotedSet.has(r.id),
    author: r.profiles ?? null,
  }))

  const { count: total } = await supabase
    .from('blueprint_notes')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', lawId)

  return NextResponse.json({
    notes,
    total: total ?? 0,
    user_note_count: userNoteCount,
  } satisfies BlueprintNotesResponse)
}

// ─── POST /api/laws/[id]/blueprint/notes ─────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to add a note' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { content?: string; aspect?: string }
  const content = (body.content ?? '').trim()
  const aspect = body.aspect ?? 'general'

  const VALID_ASPECTS: NoteAspect[] = ['phase', 'stakeholder', 'challenge', 'metric', 'resource', 'general']
  if (!VALID_ASPECTS.includes(aspect as NoteAspect)) {
    return NextResponse.json({ error: 'Invalid aspect' }, { status: 400 })
  }
  if (content.length < 10) {
    return NextResponse.json({ error: 'Note must be at least 10 characters' }, { status: 400 })
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'Note must be 500 characters or fewer' }, { status: 400 })
  }

  // Verify the law exists and is active
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Limit: max 3 notes per user per law
  const { count } = await supabase
    .from('blueprint_notes')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)
    .eq('user_id', user.id)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'You can add up to 3 notes per law blueprint' }, { status: 429 })
  }

  const { data: note, error } = await supabase
    .from('blueprint_notes')
    .insert({ law_id: params.id, user_id: user.id, content, aspect })
    .select(`
      id, law_id, user_id, content, aspect, upvotes, created_at,
      profiles:user_id ( username, display_name, avatar_url, role )
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const typedNote = note as {
    id: string; law_id: string; user_id: string; content: string; aspect: NoteAspect;
    upvotes: number; created_at: string;
    profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }

  return NextResponse.json({
    note: {
      id: typedNote.id,
      law_id: typedNote.law_id,
      user_id: typedNote.user_id,
      content: typedNote.content,
      aspect: typedNote.aspect,
      upvotes: typedNote.upvotes,
      created_at: typedNote.created_at,
      has_upvoted: false,
      author: typedNote.profiles ?? null,
    } satisfies BlueprintNote,
  }, { status: 201 })
}
