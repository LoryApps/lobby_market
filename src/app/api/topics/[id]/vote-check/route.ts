import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ side: null }, { status: 200 })
  }

  const { data } = await supabase
    .from('votes')
    .select('side')
    .eq('topic_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json(
    { side: data?.side ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
