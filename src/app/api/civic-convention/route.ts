import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConventionAmendment {
  id: string
  question: string
  description: string | null
  status: 'open' | 'passed' | 'failed' | 'vetoed'
  for_votes: number
  against_votes: number
  quorum_required: number
  closes_at: string
  created_at: string
  proposer: {
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    role: string
  } | null
  user_vote: 'for' | 'against' | null
}

export interface ConventionData {
  sessionNumber: number
  amendments: ConventionAmendment[]
  historicalCount: number
  userClout: number
  userRole: string | null
  userCanPropose: boolean
  generatedAt: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Fetch governance referendums (constitutional amendments)
    const { data: referendums } = await supabase
      .from('civic_referendums')
      .select(
        `id, question, description, status, for_votes, against_votes,
         quorum_required, closes_at, created_at, proposer_id`
      )
      .eq('category', 'governance')
      .order('created_at', { ascending: false })
      .limit(50)

    const amendments: ConventionAmendment[] = []

    if (referendums && referendums.length > 0) {
      // Fetch proposer profiles and user votes in parallel
      const proposerIds = [...new Set(referendums.map((r) => r.proposer_id).filter(Boolean))]
      const [profilesRes, votesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, clout, role')
          .in('id', proposerIds),
        user
          ? supabase
              .from('referendum_votes')
              .select('referendum_id, vote')
              .in(
                'referendum_id',
                referendums.map((r) => r.id)
              )
              .eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
      ])

      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, p])
      )
      const voteMap = new Map(
        ((votesRes as { data: Array<{ referendum_id: string; vote: string }> | null }).data ?? []).map(
          (v) => [v.referendum_id, v.vote as 'for' | 'against']
        )
      )

      for (const ref of referendums) {
        const proposer = profileMap.get(ref.proposer_id) ?? null
        amendments.push({
          id: ref.id,
          question: ref.question,
          description: ref.description ?? null,
          status: ref.status as ConventionAmendment['status'],
          for_votes: ref.for_votes,
          against_votes: ref.against_votes,
          quorum_required: ref.quorum_required,
          closes_at: ref.closes_at,
          created_at: ref.created_at,
          proposer: proposer
            ? {
                username: proposer.username,
                display_name: proposer.display_name,
                avatar_url: proposer.avatar_url,
                clout: proposer.clout,
                role: proposer.role,
              }
            : null,
          user_vote: voteMap.get(ref.id) ?? null,
        })
      }
    }

    // Session number: months since fictional founding (June 2024)
    const foundingMs = new Date('2024-06-01').getTime()
    const nowMs = Date.now()
    const sessionNumber = Math.max(1, Math.floor((nowMs - foundingMs) / (30 * 24 * 60 * 60 * 1000)) + 1)

    // Current user profile
    let userClout = 0
    let userRole: string | null = null
    let userCanPropose = false

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('clout, role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) {
        userClout = profile.clout ?? 0
        userRole = profile.role ?? null
        userCanPropose =
          userClout >= 1000 ||
          profile.role === 'elder' ||
          profile.role === 'troll_catcher'
      }
    }

    const historicalCount = amendments.filter(
      (a) => a.status !== 'open'
    ).length

    return NextResponse.json({
      sessionNumber,
      amendments,
      historicalCount,
      userClout,
      userRole,
      userCanPropose,
      generatedAt: new Date().toISOString(),
    } satisfies ConventionData)
  } catch (err) {
    console.error('[/api/civic-convention]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
