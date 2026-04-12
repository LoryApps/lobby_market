import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const tab = searchParams.get('tab') ?? 'topics'

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  if (tab === 'topics') {
    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .ilike('statement', pattern)
      .order('feed_score', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [] })
  }

  if (tab === 'laws') {
    const { data, error } = await supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
      .or(`statement.ilike.${pattern},full_statement.ilike.${pattern}`)
      .order('established_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [] })
  }

  if (tab === 'people') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .order('reputation_score', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [] })
  }

  return NextResponse.json({ results: [] })
}
