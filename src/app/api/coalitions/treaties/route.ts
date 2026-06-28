// GET /api/coalitions/treaties — global list of active & recent treaties
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TreatyRow {
  id: string
  treaty_type: string
  status: string
  title: string
  terms: string | null
  duration_days: number
  proposed_at: string
  accepted_at: string | null
  expires_at: string | null
  proposer: { id: string; name: string; member_count: number; coalition_influence: number }
  recipient: { id: string; name: string; member_count: number; coalition_influence: number }
}

export interface TreatiesResponse {
  active: TreatyRow[]
  pending: TreatyRow[]
  recent: TreatyRow[]
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('coalition_treaties')
      .select(`
        id, treaty_type, status, title, terms, duration_days,
        proposed_at, accepted_at, expires_at,
        proposer:coalitions!coalition_treaties_proposer_id_fkey(id, name, member_count, coalition_influence),
        recipient:coalitions!coalition_treaties_recipient_id_fkey(id, name, member_count, coalition_influence)
      `)
      .in('status', ['pending', 'accepted', 'expired', 'broken'])
      .order('proposed_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const now = new Date().toISOString()

    // Auto-expire treaties whose expires_at has passed
    const rows = (data ?? []) as unknown as TreatyRow[]

    const active = rows.filter(
      (t) => t.status === 'accepted' && t.expires_at && t.expires_at > now
    )
    const pending = rows.filter((t) => t.status === 'pending')
    const recent = rows.filter(
      (t) =>
        t.status !== 'pending' &&
        !(t.status === 'accepted' && t.expires_at && t.expires_at > now)
    ).slice(0, 20)

    return NextResponse.json({ active, pending, recent } satisfies TreatiesResponse)
  } catch (err) {
    console.error('[GET /api/coalitions/treaties]', err)
    return NextResponse.json({ active: [], pending: [], recent: [] })
  }
}
