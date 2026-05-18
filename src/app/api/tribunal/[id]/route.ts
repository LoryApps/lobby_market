import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── POST /api/tribunal/[id] — cast a juror vote ──────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const caseId = params.id
    const body = await req.json()
    const { vote } = body as { vote: 'sustained' | 'dismissed' }

    if (!['sustained', 'dismissed'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid vote' }, { status: 400 })
    }

    // Check user role (jurors must be debator+)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, clout')
      .eq('id', user.id)
      .single()

    const JUROR_ROLES = ['debator', 'senator', 'elder', 'lawmaker', 'troll_catcher']
    if (!profile || !JUROR_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient role to serve as juror' }, { status: 403 })
    }

    // Check case exists and is not closed
    const { data: tribunalCase } = await supabase
      .from('tribunal_cases')
      .select('*')
      .eq('id', caseId)
      .single()

    if (!tribunalCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    if (tribunalCase.status === 'closed') return NextResponse.json({ error: 'Case is closed' }, { status: 400 })

    // Ensure juror isn't the argument author
    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('user_id')
      .eq('id', tribunalCase.argument_id)
      .single()

    if (arg?.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot judge your own argument' }, { status: 400 })
    }

    // Upsert juror vote
    const { error: voteError } = await supabase
      .from('tribunal_juror_votes')
      .upsert(
        { case_id: caseId, juror_id: user.id, vote, voted_at: new Date().toISOString() },
        { onConflict: 'case_id,juror_id', ignoreDuplicates: false }
      )

    if (voteError) throw voteError

    // Count votes so far
    const { data: allVotes } = await supabase
      .from('tribunal_juror_votes')
      .select('vote')
      .eq('case_id', caseId)
      .not('vote', 'is', null)

    const sustained = allVotes?.filter((v) => v.vote === 'sustained').length ?? 0
    const dismissed = allVotes?.filter((v) => v.vote === 'dismissed').length ?? 0
    const total = (allVotes?.length ?? 0)

    // Update case status
    let newStatus: 'open' | 'deliberating' | 'closed' = tribunalCase.status
    let verdict: 'sustained' | 'dismissed' | null = null

    if (total >= 1 && tribunalCase.status === 'open') {
      newStatus = 'deliberating'
    }

    // Close if 2+ votes agree (2-of-3 majority sufficient to close early)
    if (sustained >= 2) {
      newStatus = 'closed'
      verdict = 'sustained'
    } else if (dismissed >= 2) {
      newStatus = 'closed'
      verdict = 'dismissed'
    } else if (total >= 3) {
      // 3 votes, no majority — use plurality
      newStatus = 'closed'
      verdict = sustained > dismissed ? 'sustained' : 'dismissed'
    }

    if (newStatus !== tribunalCase.status || verdict !== null) {
      await supabase
        .from('tribunal_cases')
        .update({
          status: newStatus,
          verdict: verdict ?? undefined,
          closed_at: verdict ? new Date().toISOString() : undefined,
        })
        .eq('id', caseId)

      // Award Clout to participating jurors when verdict is reached
      if (verdict) {
        const { data: winnerVotes } = await supabase
          .from('tribunal_juror_votes')
          .select('juror_id')
          .eq('case_id', caseId)
          .eq('vote', verdict)

        for (const jv of winnerVotes ?? []) {
          await supabase.rpc('gift_clout', {
            recipient_id: jv.juror_id,
            amount: 5,
            reason: 'tribunal_service',
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sustained,
      dismissed,
      total,
      status: newStatus,
      verdict,
    })
  } catch (err) {
    console.error('[tribunal/vote] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
