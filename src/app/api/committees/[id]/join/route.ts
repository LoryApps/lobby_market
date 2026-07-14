import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('committee_members')
    .insert({ committee_id: params.id, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ joined: true }) // already a member
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ joined: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('committee_members')
    .delete()
    .eq('committee_id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ left: true })
}
