import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface FollowedTagsResponse {
  tags: string[]
}

// GET /api/tags/following → list of tags the authenticated user follows
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_tag_follows')
    .select('tag, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tags = (data ?? []).map((r) => r.tag as string)
  return NextResponse.json({ tags } satisfies FollowedTagsResponse)
}
