import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/assemblies/react — observer reaction (endorse / question / object)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    assembly_id?: string
    reaction?: 'endorse' | 'question' | 'object'
  }

  if (!body.assembly_id || !body.reaction) {
    return NextResponse.json({ error: 'assembly_id and reaction required' }, { status: 400 })
  }

  const validReactions = ['endorse', 'question', 'object']
  if (!validReactions.includes(body.reaction)) {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 })
  }

  // Upsert reaction (delete + insert to handle change)
  await supabase
    .from('assembly_observer_reactions')
    .delete()
    .eq('assembly_id', body.assembly_id)
    .eq('user_id', user.id)

  const { error } = await supabase.from('assembly_observer_reactions').insert({
    assembly_id: body.assembly_id,
    user_id: user.id,
    reaction: body.reaction,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
