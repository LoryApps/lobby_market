import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/assemblies/join — join an assembly as a member
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { assembly_id?: string }
  const assemblyId = body.assembly_id

  if (!assemblyId) {
    return NextResponse.json({ error: 'assembly_id required' }, { status: 400 })
  }

  // Check assembly exists and is still forming
  const { data: assembly, error: fetchError } = await supabase
    .from('citizens_assemblies')
    .select('id, status, max_members')
    .eq('id', assemblyId)
    .single()

  if (fetchError || !assembly) {
    return NextResponse.json({ error: 'Assembly not found' }, { status: 404 })
  }

  if ((assembly as { status: string }).status !== 'forming') {
    return NextResponse.json({ error: 'Assembly is no longer accepting members' }, { status: 409 })
  }

  // Check member count
  const { count } = await supabase
    .from('assembly_members')
    .select('*', { count: 'exact', head: true })
    .eq('assembly_id', assemblyId)

  const maxMembers = (assembly as { max_members: number }).max_members
  if ((count ?? 0) >= maxMembers) {
    return NextResponse.json({ error: 'Assembly is full' }, { status: 409 })
  }

  const { error } = await supabase.from('assembly_members').insert({
    assembly_id: assemblyId,
    user_id: user.id,
    is_chair: false,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If now full, advance to deliberating
  const newCount = (count ?? 0) + 1
  if (newCount >= maxMembers) {
    await supabase
      .from('citizens_assemblies')
      .update({ status: 'deliberating' })
      .eq('id', assemblyId)
  }

  return NextResponse.json({ ok: true })
}
