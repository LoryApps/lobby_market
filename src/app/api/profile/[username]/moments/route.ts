import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CivicMoment {
  id: string
  type:
    | 'first_vote'
    | 'top_argument'
    | 'first_law_vote'
    | 'best_prediction'
    | 'most_debated_argument'
    | 'streak_peak'
    | 'first_argument'
    | 'founding_vote'
    | 'lone_dissenter'
    | 'consensus_caller'
  title: string
  description: string
  occurred_at: string
  topic_id?: string
  topic_statement?: string
  topic_status?: string
  argument_id?: string
  argument_body?: string
  metric_value?: number
  metric_label?: string
  side?: 'blue' | 'red'
  category?: string
}

export interface MomentsResponse {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    created_at: string
    total_votes: number
    total_arguments: number
  }
  moments: CivicMoment[]
  is_own_profile: boolean
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { data: { user: viewer } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, created_at, total_votes, total_arguments, vote_streak')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const uid = profile.id
  const moments: CivicMoment[] = []

  // ── 1. First vote ────────────────────────────────────────────────────────
  const { data: firstVote } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstVote) {
    const { data: firstTopic } = await supabase
      .from('topics')
      .select('statement, category, status')
      .eq('id', firstVote.topic_id)
      .maybeSingle()

    moments.push({
      id: 'first_vote',
      type: 'first_vote',
      title: 'First Vote Cast',
      description: 'The very first civic vote — the moment this citizen entered the debate.',
      occurred_at: firstVote.created_at,
      topic_id: firstVote.topic_id,
      topic_statement: firstTopic?.statement,
      topic_status: firstTopic?.status,
      side: firstVote.side as 'blue' | 'red',
      category: firstTopic?.category ?? undefined,
    })
  }

  // ── 2. Most upvoted argument ─────────────────────────────────────────────
  const { data: topArg } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, topic_id, side, created_at')
    .eq('user_id', uid)
    .order('upvotes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (topArg && topArg.upvotes > 0) {
    const { data: argTopic } = await supabase
      .from('topics')
      .select('statement, category, status')
      .eq('id', topArg.topic_id)
      .maybeSingle()

    moments.push({
      id: 'top_argument',
      type: 'top_argument',
      title: 'Most Upvoted Argument',
      description: "The community's favourite — this argument earned more upvotes than any other.",
      occurred_at: topArg.created_at,
      topic_id: topArg.topic_id,
      topic_statement: argTopic?.statement,
      topic_status: argTopic?.status,
      argument_id: topArg.id,
      argument_body: topArg.content,
      metric_value: topArg.upvotes,
      metric_label: 'upvotes',
      side: topArg.side as 'blue' | 'red',
      category: argTopic?.category ?? undefined,
    })
  }

  // ── 3. First argument posted ─────────────────────────────────────────────
  const { data: firstArg } = await supabase
    .from('topic_arguments')
    .select('id, content, topic_id, side, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstArg && (!topArg || firstArg.id !== topArg.id)) {
    const { data: faTopic } = await supabase
      .from('topics')
      .select('statement, category, status')
      .eq('id', firstArg.topic_id)
      .maybeSingle()

    moments.push({
      id: 'first_argument',
      type: 'first_argument',
      title: 'First Argument Posted',
      description: 'Where it all began — the first time this citizen put their case in writing.',
      occurred_at: firstArg.created_at,
      topic_id: firstArg.topic_id,
      topic_statement: faTopic?.statement,
      topic_status: faTopic?.status,
      argument_id: firstArg.id,
      argument_body: firstArg.content,
      side: firstArg.side as 'blue' | 'red',
      category: faTopic?.category ?? undefined,
    })
  }

  // ── 4. First vote on a topic that became law ─────────────────────────────
  const { data: allVotes } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })

  if (allVotes && allVotes.length > 0) {
    const topicIds = [...new Set(allVotes.map((v) => v.topic_id))]
    // Fetch law topics the user voted on
    const { data: lawTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, created_at')
      .in('id', topicIds)
      .eq('status', 'law')
      .order('created_at', { ascending: true })
      .limit(1)

    const firstLaw = lawTopics?.[0]
    if (firstLaw) {
      const matchVote = allVotes.find((v) => v.topic_id === firstLaw.id)
      moments.push({
        id: 'first_law_vote',
        type: 'first_law_vote',
        title: 'First Law Co-Created',
        description: 'This vote helped turn a debate into an established law — civic history made.',
        occurred_at: matchVote?.created_at ?? firstLaw.created_at,
        topic_id: firstLaw.id,
        topic_statement: firstLaw.statement,
        topic_status: 'law',
        side: matchVote?.side as 'blue' | 'red' | undefined,
        category: firstLaw.category ?? undefined,
      })
    }

    // ── 5. Lone dissenter (voted against 75%+ majority) ──────────────────
    const { data: topicsForDissent } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .gte('total_votes', 50)

    let maxDissent = 75
    let dissentMoment: CivicMoment | null = null

    for (const t of topicsForDissent ?? []) {
      const uv = allVotes.find((v) => v.topic_id === t.id)
      if (!uv) continue
      const dissent = uv.side === 'red' ? t.blue_pct : 100 - t.blue_pct
      if (dissent >= maxDissent) {
        maxDissent = dissent
        dissentMoment = {
          id: 'lone_dissenter',
          type: 'lone_dissenter',
          title: 'Lone Dissenter',
          description: `Voted against ${Math.round(dissent)}% of the crowd. Not every rebel is wrong.`,
          occurred_at: uv.created_at,
          topic_id: t.id,
          topic_statement: t.statement,
          topic_status: t.status,
          metric_value: Math.round(dissent),
          metric_label: '% of crowd on opposite side',
          side: uv.side as 'blue' | 'red',
          category: t.category ?? undefined,
        }
      }
    }
    if (dissentMoment) moments.push(dissentMoment)

    // ── 6. Consensus caller (voted with 70%+ majority on a popular law) ──
    const { data: consensusTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .eq('status', 'law')
      .gte('blue_pct', 70)
      .gte('total_votes', 100)
      .order('total_votes', { ascending: false })
      .limit(1)

    const ctop = consensusTopics?.[0]
    if (ctop) {
      const cv = allVotes.find((v) => v.topic_id === ctop.id)
      if (cv && cv.side === 'blue') {
        moments.push({
          id: 'consensus_caller',
          type: 'consensus_caller',
          title: 'Consensus Caller',
          description: `Voted with the winning ${Math.round(ctop.blue_pct)}% majority on one of the platform's most-voted debates.`,
          occurred_at: cv.created_at,
          topic_id: ctop.id,
          topic_statement: ctop.statement,
          topic_status: 'law',
          metric_value: ctop.total_votes,
          metric_label: 'votes on this topic',
          side: 'blue',
          category: ctop.category ?? undefined,
        })
      }
    }
  }

  // ── 7. Most replied-to argument ──────────────────────────────────────────
  const { data: userArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, topic_id, side, created_at')
    .eq('user_id', uid)
    .limit(100)

  if (userArgs && userArgs.length > 0) {
    // Count replies for each argument using a loop (no SQL aggregate in PostgREST easily)
    const argIds = userArgs.map((a) => a.id)
    const { data: replyCounts } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)

    if (replyCounts && replyCounts.length > 0) {
      const countMap: Record<string, number> = {}
      for (const r of replyCounts) {
        countMap[r.argument_id] = (countMap[r.argument_id] ?? 0) + 1
      }
      const maxEntry = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0]
      if (maxEntry && maxEntry[1] >= 2) {
        const [maxArgId, maxCount] = maxEntry
        const debatedArg = userArgs.find((a) => a.id === maxArgId)
        if (debatedArg && (!topArg || debatedArg.id !== topArg.id) && (!firstArg || debatedArg.id !== firstArg.id)) {
          const { data: daTopic } = await supabase
            .from('topics')
            .select('statement, category, status')
            .eq('id', debatedArg.topic_id)
            .maybeSingle()

          moments.push({
            id: 'most_debated_argument',
            type: 'most_debated_argument',
            title: 'Most Debated Argument',
            description: 'This argument sparked the most back-and-forth — it cut right to the heart of the debate.',
            occurred_at: debatedArg.created_at,
            topic_id: debatedArg.topic_id,
            topic_statement: daTopic?.statement,
            topic_status: daTopic?.status,
            argument_id: debatedArg.id,
            argument_body: debatedArg.content,
            metric_value: maxCount,
            metric_label: 'replies',
            side: debatedArg.side as 'blue' | 'red',
            category: daTopic?.category ?? undefined,
          })
        }
      }
    }
  }

  // ── 8. Best prediction win ───────────────────────────────────────────────
  const { data: bestPred } = await supabase
    .from('topic_predictions')
    .select('id, topic_id, predicted_law, confidence, correct, clout_earned, resolved_at, created_at')
    .eq('user_id', uid)
    .eq('correct', true)
    .order('clout_earned', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (bestPred) {
    const { data: predTopic } = await supabase
      .from('topics')
      .select('statement, category, status')
      .eq('id', bestPred.topic_id)
      .maybeSingle()

    moments.push({
      id: 'best_prediction',
      type: 'best_prediction',
      title: 'Best Prediction Win',
      description: 'Called it. This prediction earned the most clout — the civic oracle at work.',
      occurred_at: bestPred.resolved_at ?? bestPred.created_at,
      topic_id: bestPred.topic_id,
      topic_statement: predTopic?.statement,
      topic_status: predTopic?.status,
      metric_value: bestPred.clout_earned ?? Math.round(bestPred.confidence),
      metric_label: bestPred.clout_earned ? 'clout earned' : '% confidence',
      category: predTopic?.category ?? undefined,
    })
  }

  moments.sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      created_at: profile.created_at,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
    },
    moments,
    is_own_profile: viewer?.id === profile.id,
  } satisfies MomentsResponse)
}
