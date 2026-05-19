import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// DELETE /api/arguments/drafts/by-topic/[topicId] — delete draft for a specific topic
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('argument_drafts')
    .delete()
    .eq('topic_id', params.topicId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
