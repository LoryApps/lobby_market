import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const COUNCIL_SIZE = 20

async function isCouncilMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .order('clout', { ascending: false })
    .limit(COUNCIL_SIZE)
  return (data ?? []).some((p) => p.id === userId)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const member = await isCouncilMember(supabase, user.id)
    if (!member) {
      return NextResponse.json({ error: 'Only Grand Council members can propose motions' }, { status: 403 })
    }

    const body = await req.json()
    const { title, description, effect, topic_id } = body

    if (!title?.trim() || title.trim().length < 5 || title.trim().length > 120) {
      return NextResponse.json({ error: 'Title must be 5–120 characters' }, { status: 400 })
    }
    if (!description?.trim() || description.trim().length < 10 || description.trim().length > 1000) {
      return NextResponse.json({ error: 'Description must be 10–1000 characters' }, { status: 400 })
    }
    const validEffects = ['elevate_topic', 'issue_statement', 'call_assembly']
    if (!validEffects.includes(effect)) {
      return NextResponse.json({ error: 'Invalid effect' }, { status: 400 })
    }
    if ((effect === 'elevate_topic' || effect === 'call_assembly') && !topic_id) {
      return NextResponse.json({ error: 'A topic is required for this effect' }, { status: 400 })
    }

    const { data, error } = await supabase
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
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[grand-council motion POST]', err)
    return NextResponse.json({ error: 'Failed to create motion' }, { status: 500 })
  }
}
