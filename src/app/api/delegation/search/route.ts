import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DelegateCandidate {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  role: string
  total_votes: number
  vote_streak: number
  civic_archetype: string | null
  trusted_by: number
}

export interface DelegateSearchResponse {
  candidates: DelegateCandidate[]
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role, total_votes, vote_streak, civic_archetype')
    .neq('id', user.id)
    .gt('total_votes', 10)
    .order('clout', { ascending: false })
    .limit(20)

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data: profiles } = await query

  // Fetch trusted_by counts for these profiles
  const profileIds = (profiles ?? []).map((p: Record<string, unknown>) => p.id as string)
  const trustedByMap: Record<string, number> = {}

  if (profileIds.length > 0) {
    const { data: stats } = await supabase
      .from('vote_delegations')
      .select('delegate_id')
      .in('delegate_id', profileIds)
      .is('revoked_at', null)

    for (const row of stats ?? []) {
      const r = row as { delegate_id: string }
      trustedByMap[r.delegate_id] = (trustedByMap[r.delegate_id] ?? 0) + 1
    }
  }

  const candidates: DelegateCandidate[] = (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    username: p.username as string,
    display_name: p.display_name as string | null,
    avatar_url: p.avatar_url as string | null,
    clout: p.clout as number,
    role: p.role as string,
    total_votes: p.total_votes as number,
    vote_streak: p.vote_streak as number,
    civic_archetype: p.civic_archetype as string | null,
    trusted_by: trustedByMap[p.id as string] ?? 0,
  }))

  return NextResponse.json({ candidates } satisfies DelegateSearchResponse)
}
