import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [countResult, watchedResult] = await Promise.all([
    supabase
      .from('thesis_watchlist')
      .select('id', { count: 'exact', head: true })
      .eq('thesis_id', params.id),
    user
      ? supabase
          .from('thesis_watchlist')
          .select('id')
          .eq('thesis_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    watching: !!watchedResult.data,
    count: countResult.count ?? 0,
  })
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('thesis_watchlist')
    .upsert({ user_id: user.id, thesis_id: params.id }, { onConflict: 'user_id,thesis_id' })

  const { count } = await supabase
    .from('thesis_watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('thesis_id', params.id)

  return NextResponse.json({ watching: true, count: count ?? 0 })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('thesis_watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('thesis_id', params.id)

  const { count } = await supabase
    .from('thesis_watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('thesis_id', params.id)

  return NextResponse.json({ watching: false, count: count ?? 0 })
}
