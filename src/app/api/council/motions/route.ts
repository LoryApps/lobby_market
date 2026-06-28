import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const COUNCIL_SIZE = 20

async function isCouncilMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  // Council = top COUNCIL_SIZE by clout
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .order('clout', { ascending: false })
    .limit(COUNCIL_SIZE)

  return (data ?? []).some((p) => p.id === userId)
}

// ─── POST /api/council/motions — propose a new motion ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!(await isCouncilMember(supabase, user.id))) {
      return NextResponse.json({ error: 'Only Grand Council members may propose motions' }, { status: 403 })
    }

    const body = await req.json()
    const { title, description, effect, topic_id } = body as {
      title: string
      description: string
      effect: string
      topic_id?: string | null
    }

    if (!title || title.trim().length < 5) {
      return NextResponse.json({ error: 'Title must be at least 5 characters' }, { status: 400 })
    }
    if (!description || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (!['elevate_topic', 'issue_statement', 'call_assembly'].includes(effect)) {
      return NextResponse.json({ error: 'Invalid effect' }, { status: 400 })
    }
    if ((effect === 'elevate_topic' || effect === 'call_assembly') && !topic_id) {
      return NextResponse.json({ error: 'A topic is required for this motion type' }, { status: 400 })
    }

    const { data: motion, error } = await supabase
      .from('council_motions')
      .insert({
        proposer_id: user.id,
        title: title.trim(),
        description: description.trim(),
        effect,
        topic_id: topic_id ?? null,
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ motion_id: motion.id })
  } catch (err) {
    console.error('[POST /api/council/motions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
