import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}
