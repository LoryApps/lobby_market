import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/topics/[id]/view
// Records a view for a topic. The app layer deduplicates using sessionStorage
// so this endpoint is not rate-limited — it trusts the client to call at most
// once per topic per browser session.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('increment_topic_view', {
    topic_uuid: params.id,
  })

  if (error) {
    // Non-fatal — view count is a best-effort metric
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
