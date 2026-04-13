import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/bookmarks
 * Returns the list of topic IDs bookmarked by the current user.
 * Used to seed the client-side bookmark store.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ topicIds: [] })
  }

  const { data } = await supabase
    .from('topic_bookmarks')
    .select('topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const topicIds = (data ?? []).map((row: { topic_id: string }) => row.topic_id)

  return NextResponse.json({ topicIds })
}
