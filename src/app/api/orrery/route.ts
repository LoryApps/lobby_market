import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface OrreryTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
}

export interface OrreryResponse {
  topics: OrreryTopic[]
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, total_arguments')
    .in('status', ['active', 'voting', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(80)

  if (error) {
    return NextResponse.json({ topics: [] })
  }

  return NextResponse.json({ topics: data ?? [] } satisfies OrreryResponse)
}
