import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/civic-petitions/[id]/sign
 *
 * Toggles the current user's signature on a petition.
 * Uses the toggle_petition_signature() RPC defined in migration 00102.
 * Returns: { signed: boolean, signature_count: number }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { data, error } = await supabase.rpc('toggle_petition_signature', {
    p_petition_id: params.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = data as { signed?: boolean; signature_count?: number; error?: string }
  if (result?.error) {
    const statusMap: Record<string, number> = {
      not_authenticated: 401,
      not_found: 404,
      petition_closed: 409,
      petition_expired: 410,
    }
    return NextResponse.json(
      { error: result.error },
      { status: statusMap[result.error] ?? 400 }
    )
  }

  return NextResponse.json({
    signed: result.signed ?? false,
    signature_count: result.signature_count ?? 0,
  })
}
