// GET /api/coalitions/[id]/membership — returns current user's role in this coalition
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Ctx { params: { id: string } }

export interface MembershipResponse {
  user_id: string | null
  role: 'leader' | 'officer' | 'member' | null
  is_member: boolean
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user_id: null, role: null, is_member: false } satisfies MembershipResponse)
    }

    const { data } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      user_id: user.id,
      role: (data?.role ?? null) as MembershipResponse['role'],
      is_member: data !== null,
    } satisfies MembershipResponse)
  } catch (err) {
    console.error('[GET /api/coalitions/[id]/membership]', err)
    return NextResponse.json({ user_id: null, role: null, is_member: false })
  }
}
