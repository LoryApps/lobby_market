import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/clout/balance
// Returns the current user's Clout balance and their last 20 transactions.
export async function GET(_request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile }, { data: recent }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('clout_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({
    profile,
    balance: profile.clout ?? 0,
    transactions: recent ?? [],
  })
}
