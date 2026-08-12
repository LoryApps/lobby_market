import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PassportCategory {
  category: string
  vote_count: number
  side: 'for' | 'against' | 'balanced'
}

export interface PassportData {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  blue_vote_count: number
  red_vote_count: number
  vote_streak: number
  civic_archetype: string | null
  created_at: string
  laws_supported: number
  top_categories: PassportCategory[]
  passport_number: string
}

function toPassportNumber(userId: string): string {
  const hex = userId.replace(/-/g, '')
  const n = parseInt(hex.slice(0, 8), 16) % 100_000_000
  return n.toString().padStart(8, '0')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, reputation_score, ' +
      'total_votes, total_arguments, blue_vote_count, red_vote_count, vote_streak, ' +
      'civic_archetype, created_at'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Votes with topic category and status for category/law calculations
  const { data: votes } = await supabase
    .from('votes')
    .select('side, topics(id, category, status)')
    .eq('user_id', profile.id)
    .limit(1000)

  const allVotes = votes ?? []

  // Laws supported = blue votes where the topic became law
  const lawsSupported = allVotes.filter((v) => {
    const t = v.topics as { id: string; category: string | null; status: string } | null
    return v.side === 'blue' && t?.status === 'law'
  }).length

  const catMap: Record<string, { for: number; against: number }> = {}
  for (const v of allVotes) {
    const cat = (v.topics as { id: string; category: string | null; status: string } | null)?.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { for: 0, against: 0 }
    if (v.side === 'blue') catMap[cat].for++
    else catMap[cat].against++
  }

  const topCategories: PassportCategory[] = Object.entries(catMap)
    .map(([category, counts]) => ({
      category,
      vote_count: counts.for + counts.against,
      side:
        counts.for > counts.against * 1.2
          ? 'for'
          : counts.against > counts.for * 1.2
          ? 'against'
          : 'balanced',
    }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 4) as PassportCategory[]

  const passportData: PassportData = {
    ...profile,
    laws_supported: lawsSupported,
    top_categories: topCategories,
    passport_number: toPassportNumber(profile.id),
  }

  return NextResponse.json(passportData)
}
