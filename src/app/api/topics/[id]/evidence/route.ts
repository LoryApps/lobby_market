import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EvidenceItem {
  id: string
  topic_id: string
  user_id: string
  url: string
  title: string
  description: string | null
  domain: string | null
  side: 'for' | 'against' | 'neutral'
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  viewer_voted: boolean
}

export interface EvidenceResponse {
  items: EvidenceItem[]
  counts: { for: number; against: number; neutral: number; total: number }
  viewer_id: string | null
}

// ─── GET — list evidence for a topic ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Fetch evidence rows with author profiles
    const { data: rows, error } = await supabase
      .from('topic_evidence')
      .select(`
        id,
        topic_id,
        user_id,
        url,
        title,
        description,
        domain,
        side,
        upvotes,
        created_at,
        author:profiles!user_id (
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Fetch viewer's votes in one query
    let voterSet = new Set<string>()
    if (user && rows && rows.length > 0) {
      const ids = rows.map((r) => r.id)
      const { data: votes } = await supabase
        .from('topic_evidence_votes')
        .select('evidence_id')
        .eq('user_id', user.id)
        .in('evidence_id', ids)
      if (votes) voterSet = new Set(votes.map((v) => v.evidence_id))
    }

    const items: EvidenceItem[] = (rows ?? []).map((r) => ({
      id: r.id,
      topic_id: r.topic_id,
      user_id: r.user_id,
      url: r.url,
      title: r.title,
      description: r.description ?? null,
      domain: r.domain ?? null,
      side: r.side as 'for' | 'against' | 'neutral',
      upvotes: r.upvotes,
      created_at: r.created_at,
      author: Array.isArray(r.author) ? (r.author[0] ?? null) : (r.author ?? null),
      viewer_voted: voterSet.has(r.id),
    }))

    const counts = {
      for:     items.filter((i) => i.side === 'for').length,
      against: items.filter((i) => i.side === 'against').length,
      neutral: items.filter((i) => i.side === 'neutral').length,
      total:   items.length,
    }

    return NextResponse.json({
      items,
      counts,
      viewer_id: user?.id ?? null,
    } satisfies EvidenceResponse)
  } catch (err) {
    console.error('[evidence GET]', err)
    return NextResponse.json({ error: 'Failed to load evidence' }, { status: 500 })
  }
}

// ─── POST — submit new evidence ───────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      url?: string
      title?: string
      description?: string
      side?: string
    }

    const url = body.url?.trim() ?? ''
    const title = body.title?.trim() ?? ''
    const description = body.description?.trim() || null
    const side = body.side ?? 'neutral'

    if (!url || !/^https?:\/\//i.test(url) || url.length > 2000) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    if (!title || title.length < 5 || title.length > 200) {
      return NextResponse.json({ error: 'Title must be 5–200 characters' }, { status: 400 })
    }
    if (!['for', 'against', 'neutral'].includes(side)) {
      return NextResponse.json({ error: 'Invalid side' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('topic_evidence')
      .insert({
        topic_id: params.id,
        user_id: user.id,
        url,
        title,
        description,
        side,
      })
      .select(`
        id,
        topic_id,
        user_id,
        url,
        title,
        description,
        domain,
        side,
        upvotes,
        created_at,
        author:profiles!user_id (
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This URL has already been submitted for this topic' }, { status: 409 })
      }
      throw error
    }

    const item: EvidenceItem = {
      id: data.id,
      topic_id: data.topic_id,
      user_id: data.user_id,
      url: data.url,
      title: data.title,
      description: data.description ?? null,
      domain: data.domain ?? null,
      side: data.side as 'for' | 'against' | 'neutral',
      upvotes: data.upvotes,
      created_at: data.created_at,
      author: Array.isArray(data.author) ? (data.author[0] ?? null) : (data.author ?? null),
      viewer_voted: false,
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    console.error('[evidence POST]', err)
    return NextResponse.json({ error: 'Failed to submit evidence' }, { status: 500 })
  }
}
