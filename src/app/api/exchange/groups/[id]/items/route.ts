import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Props { params: { id: string } }

// POST — add a market to the group
export async function POST(req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: group } = await supabase
    .from('exchange_groups')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { topic_id?: string }
  const { topic_id } = body
  if (!topic_id) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('exchange_group_items')
    .insert({ group_id: params.id, topic_id })
    .select('id, group_id, topic_id, added_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Market already in group' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove a market from the group (?topic_id=xxx)
export async function DELETE(req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topicId = new URL(req.url).searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  // Verify ownership via the group
  const { data: group } = await supabase
    .from('exchange_groups')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('exchange_group_items')
    .delete()
    .eq('group_id', params.id)
    .eq('topic_id', topicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
