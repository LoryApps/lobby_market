import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TestimonyRow {
  id: string
  hearing_id: string
  user_id: string
  content: string
  stance: 'for' | 'against' | 'neutral'
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface HearingDetailResponse {
  testimonies: TestimonyRow[]
  total: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const stance = searchParams.get('stance')

  try {
    let query = supabase
      .from('civic_testimonies')
      .select('*', { count: 'exact' })
      .eq('hearing_id', params.id)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (stance && ['for', 'against', 'neutral'].includes(stance)) {
      query = query.eq('stance', stance)
    }

    const { data: rawTestimonies, count, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ testimonies: [], total: 0 } satisfies HearingDetailResponse)
      }
      throw error
    }

    if (!rawTestimonies?.length) {
      return NextResponse.json({ testimonies: [], total: count ?? 0 } satisfies HearingDetailResponse)
    }

    const authorIds = [...new Set(rawTestimonies.map((t: { user_id: string }) => t.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [p.id, p])
    )

    const testimonies: TestimonyRow[] = rawTestimonies.map((t: {
      id: string;
      hearing_id: string;
      user_id: string;
      content: string;
      stance: 'for' | 'against' | 'neutral';
      upvotes: number;
      created_at: string;
    }) => {
      const author = profileMap.get(t.user_id)
      return {
        ...t,
        author: author ? {
          username: author.username,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
          role: author.role,
        } : null,
      }
    })

    return NextResponse.json({ testimonies, total: count ?? 0 } satisfies HearingDetailResponse)
  } catch (err) {
    console.error('[hearing detail GET]', err)
    return NextResponse.json({ error: 'Failed to fetch testimonies' }, { status: 500 })
  }
}
