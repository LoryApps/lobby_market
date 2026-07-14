import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Shared types exported for the client component ───────────────────────────

export interface SIMaker {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface SIPrayer {
  id: string
  prayer_text: string
  seconds_count: number
  status: 'active' | 'succeeded' | 'failed' | 'expired'
  created_at: string
  author: SIMaker
  user_has_seconded: boolean
}

export type SIStatus = 'draft' | 'laid' | 'in_force' | 'annulled' | 'approved' | 'rejected' | 'withdrawn'
export type SIProcedure = 'negative' | 'affirmative' | 'super_affirmative'

export interface StatutoryInstrument {
  id: string
  reference: string
  short_title: string
  description: string
  category: string
  procedure: SIProcedure
  status: SIStatus
  laid_at: string | null
  window_closes_at: string | null
  in_force_at: string | null
  vote_closes_at: string | null
  yes_votes: number
  no_votes: number
  prayer_count: number
  created_at: string
  maker: SIMaker
  prayers: SIPrayer[]
  user_has_voted: string | null   // 'yes' | 'no' | 'abstain' | null
  user_has_prayed: boolean
  days_remaining: number | null
}

export interface SIListResponse {
  items: StatutoryInstrument[]
  filter: string
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse<SIListResponse | { error: string }>> {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'active'

  // Advance window-expired negative SIs to in_force
  await supabase.rpc('check_si_windows').maybeSingle()

  const { data: { user } } = await supabase.auth.getUser()

  // Determine status filter
  let statuses: SIStatus[]
  if (filter === 'active')    statuses = ['laid']
  else if (filter === 'force') statuses = ['in_force', 'approved']
  else if (filter === 'resolved') statuses = ['annulled', 'rejected', 'withdrawn']
  else                         statuses = ['draft', 'laid', 'in_force', 'annulled', 'approved', 'rejected', 'withdrawn']

  const { data: rows, error } = await supabase
    .from('statutory_instruments')
    .select(`
      id, reference, short_title, description, category, procedure, status,
      laid_at, window_closes_at, in_force_at, vote_closes_at,
      yes_votes, no_votes, prayer_count, created_at,
      maker:profiles!maker_id (id, username, display_name, avatar_url, role, clout)
    `)
    .in('status', statuses)
    .order('laid_at', { ascending: false })
    .limit(40)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch prayers for each SI
  const siIds = (rows ?? []).map((r) => r.id)
  const [prayersRes, userVotesRes, userPrayersRes] = await Promise.all([
    siIds.length > 0
      ? supabase
          .from('si_prayers')
          .select(`
            id, prayer_text, seconds_count, status, created_at, si_id,
            author:profiles!author_id (id, username, display_name, avatar_url, role, clout)
          `)
          .in('si_id', siIds)
          .order('seconds_count', { ascending: false })
      : Promise.resolve({ data: [], error: null }),

    user && siIds.length > 0
      ? supabase
          .from('si_votes')
          .select('si_id, vote')
          .eq('user_id', user.id)
          .in('si_id', siIds)
      : Promise.resolve({ data: [], error: null }),

    user && siIds.length > 0
      ? supabase
          .from('si_prayers')
          .select('si_id')
          .eq('author_id', user.id)
          .in('si_id', siIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Fetch prayer seconds for current user
  const prayerIds = (prayersRes.data ?? []).map((p: { id: string }) => p.id)
  const userSecondsRes = user && prayerIds.length > 0
    ? await supabase
        .from('si_prayer_seconds')
        .select('prayer_id')
        .eq('user_id', user.id)
        .in('prayer_id', prayerIds)
    : { data: [] }

  const userSeconded = new Set((userSecondsRes.data ?? []).map((s: { prayer_id: string }) => s.prayer_id))
  const userVoteMap = new Map<string, string>(
    (userVotesRes.data ?? []).map((v: { si_id: string; vote: string }) => [v.si_id, v.vote])
  )
  const userPrayedSet = new Set((userPrayersRes.data ?? []).map((p: { si_id: string }) => p.si_id))

  // Group prayers by SI
  const prayersBySI = new Map<string, SIPrayer[]>()
  for (const prayer of prayersRes.data ?? []) {
    const p = prayer as {
      id: string; prayer_text: string; seconds_count: number; status: string
      created_at: string; si_id: string
      author: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }
    }
    if (!prayersBySI.has(p.si_id)) prayersBySI.set(p.si_id, [])
    prayersBySI.get(p.si_id)!.push({
      id: p.id,
      prayer_text: p.prayer_text,
      seconds_count: p.seconds_count,
      status: p.status as SIPrayer['status'],
      created_at: p.created_at,
      author: p.author,
      user_has_seconded: userSeconded.has(p.id),
    })
  }

  const now = Date.now()

  const items: StatutoryInstrument[] = (rows ?? []).map((row) => {
    const r = row as typeof row & {
      maker: SIMaker
    }
    const windowClose = r.window_closes_at ? new Date(r.window_closes_at).getTime() : null
    const daysRemaining = windowClose
      ? Math.max(0, Math.ceil((windowClose - now) / 86_400_000))
      : null

    return {
      id: r.id,
      reference: r.reference,
      short_title: r.short_title,
      description: r.description,
      category: r.category,
      procedure: r.procedure as SIProcedure,
      status: r.status as SIStatus,
      laid_at: r.laid_at,
      window_closes_at: r.window_closes_at,
      in_force_at: r.in_force_at,
      vote_closes_at: r.vote_closes_at,
      yes_votes: r.yes_votes,
      no_votes: r.no_votes,
      prayer_count: r.prayer_count,
      created_at: r.created_at,
      maker: r.maker,
      prayers: prayersBySI.get(r.id) ?? [],
      user_has_voted: userVoteMap.get(r.id) ?? null,
      user_has_prayed: userPrayedSet.has(r.id),
      days_remaining: daysRemaining,
    }
  })

  return NextResponse.json({ items, filter })
}

// ── POST: create a new SI ─────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse<{ id: string } | { error: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check reputation (coalition leader or 500+ clout)
  const { data: profile } = await supabase
    .from('profiles')
    .select('clout, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.clout < 500 && profile.role === 'person')) {
    return NextResponse.json({ error: 'Insufficient standing to table a Statutory Instrument (500+ clout required)' }, { status: 403 })
  }

  const body = await req.json() as {
    short_title: string
    description: string
    category: string
    procedure: SIProcedure
    reference?: string
  }

  const { short_title, description, category, procedure, reference } = body

  if (!short_title || !description || !category || !procedure) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Auto-generate reference if not provided
  const ref = reference ?? `SI ${new Date().getFullYear()}/${String(Date.now()).slice(-3)}`

  // Calculate window
  const now = new Date()
  const windowClose = new Date(now)
  windowClose.setDate(windowClose.getDate() + 40)

  const { data, error } = await supabase
    .from('statutory_instruments')
    .insert({
      reference: ref,
      short_title,
      description,
      category,
      procedure,
      status: 'laid',
      maker_id: user.id,
      laid_at: now.toISOString(),
      window_closes_at: procedure === 'negative' ? windowClose.toISOString() : null,
      vote_closes_at: procedure === 'affirmative' ? windowClose.toISOString() : null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

// ── PATCH: cast a vote (affirmative) or table / second a prayer (negative) ───

export async function PATCH(req: Request): Promise<NextResponse<{ ok: boolean } | { error: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'vote' | 'prayer' | 'second'
    si_id: string
    vote?: 'yes' | 'no' | 'abstain'
    prayer_text?: string
    prayer_id?: string
  }

  const { action, si_id } = body

  if (action === 'vote') {
    const { vote } = body
    if (!vote) return NextResponse.json({ error: 'vote required' }, { status: 400 })
    const { error } = await supabase
      .from('si_votes')
      .upsert({ si_id, user_id: user.id, vote }, { onConflict: 'si_id,user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update yes/no counts
    const { data: votes } = await supabase.from('si_votes').select('vote').eq('si_id', si_id)
    const yes = (votes ?? []).filter((v: { vote: string }) => v.vote === 'yes').length
    const no  = (votes ?? []).filter((v: { vote: string }) => v.vote === 'no').length
    await supabase.from('statutory_instruments').update({ yes_votes: yes, no_votes: no }).eq('id', si_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'prayer') {
    const { prayer_text } = body
    if (!prayer_text) return NextResponse.json({ error: 'prayer_text required' }, { status: 400 })
    const { error } = await supabase
      .from('si_prayers')
      .insert({ si_id, author_id: user.id, prayer_text })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'second') {
    const { prayer_id } = body
    if (!prayer_id) return NextResponse.json({ error: 'prayer_id required' }, { status: 400 })
    const { error } = await supabase
      .from('si_prayer_seconds')
      .upsert({ si_id, prayer_id, user_id: user.id }, { onConflict: 'prayer_id,user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
