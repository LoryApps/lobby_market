import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST  /api/ama/requests/[id]/vote  — toggle upvote on a request
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const requestId = params.id

    // Check if user already voted
    const { data: existing } = await supabase
      .from('ama_request_votes')
      .select('request_id')
      .eq('request_id', requestId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Remove vote
      await supabase
        .from('ama_request_votes')
        .delete()
        .eq('request_id', requestId)
        .eq('user_id', user.id)
      return NextResponse.json({ voted: false })
    } else {
      // Add vote
      const { error } = await supabase
        .from('ama_request_votes')
        .insert({ request_id: requestId, user_id: user.id })
      if (error) throw error
      return NextResponse.json({ voted: true })
    }
  } catch (err) {
    console.error('[/api/ama/requests/[id]/vote]', err)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
