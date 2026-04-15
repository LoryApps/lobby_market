import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CoalitionStanceEntry {
  id: string
  coalition_id: string
  topic_id: string
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  declared_by: string
  created_at: string
  updated_at: string
  coalition: {
    id: string
    name: string
    color: string | null
    badge_emoji: string | null
    member_count: number
    coalition_influence: number
  }
  declarer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coalition_stances')
    .select(`
      id,
      coalition_id,
      topic_id,
      stance,
      statement,
      declared_by,
      created_at,
      updated_at,
      coalition:coalitions (
        id,
        name,
        color,
        badge_emoji,
        member_count,
        coalition_influence
      ),
      declarer:profiles!coalition_stances_declared_by_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', params.id)
    .order('coalition_influence', { referencedTable: 'coalitions', ascending: false })

  if (error) {
    // Table may not exist on older deployments — return empty gracefully
    return NextResponse.json({ stances: [] })
  }

  return NextResponse.json({ stances: (data ?? []) as unknown as CoalitionStanceEntry[] })
}
