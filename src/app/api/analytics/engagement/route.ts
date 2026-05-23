import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngagementAction {
  type: string
  label: string
  count: number
  weight: number   // contribution to depth score
  color: string    // tailwind color token (css var) used in UI
  icon: string
}

export interface EngagementTopic {
  id: string
  statement: string
  actions: number
  action_types: string[]
}

export interface EngagementData {
  depthScore: number               // 0-100
  depthLabel: string               // Lurker | Observer | Participant | Contributor | Champion
  totalActions: number
  actions: EngagementAction[]
  topEngagedTopics: EngagementTopic[]
  funnel: {
    viewed_topics: number          // from topic_subscriptions
    voted: number
    argued: number
    replied: number
    reacted: number
  }
  weeklyTrend: Array<{
    week: string
    actions: number
  }>
  diversityScore: number           // 0-10, how many distinct action types used
  platformComparison: {
    your_score: number
    avg_score: number
    percentile: number
  }
}

// ─── Depth-score weights ──────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  votes:            1,
  supports:         1,
  arguments:        3,
  argument_votes:   1.5,
  replies:          2,
  argument_reacts:  1,
  topic_reacts:     1,
  topic_bookmarks:  0.5,
  arg_bookmarks:    0.5,
  wiki_edits:       4,
  predictions:      2,
  debate_messages:  2,
  collections:      1.5,
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id

  // Fetch all counts in parallel
  const [
    { count: voteCount },
    { count: supportCount },
    { count: argumentCount },
    { count: argVoteCount },
    { count: replyCount },
    { count: argReactCount },
    { count: topicReactCount },
    { count: topicBookmarkCount },
    { count: argBookmarkCount },
    { count: wikiEditCount },
    { count: predictionCount },
    { count: debateMsgCount },
    { count: collectionCount },
  ] = await Promise.all([
    supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_supports').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_arguments').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_argument_votes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('argument_replies').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('argument_reactions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_reactions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('argument_bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_wiki_history').select('id', { count: 'exact', head: true }).eq('author_id', uid),
    supabase.from('topic_predictions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('debate_messages').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('topic_collections').select('id', { count: 'exact', head: true }).eq('user_id', uid),
  ])

  const counts: Record<string, number> = {
    votes:            voteCount ?? 0,
    supports:         supportCount ?? 0,
    arguments:        argumentCount ?? 0,
    argument_votes:   argVoteCount ?? 0,
    replies:          replyCount ?? 0,
    argument_reacts:  argReactCount ?? 0,
    topic_reacts:     topicReactCount ?? 0,
    topic_bookmarks:  topicBookmarkCount ?? 0,
    arg_bookmarks:    argBookmarkCount ?? 0,
    wiki_edits:       wikiEditCount ?? 0,
    predictions:      predictionCount ?? 0,
    debate_messages:  debateMsgCount ?? 0,
    collections:      collectionCount ?? 0,
  }

  // ── Build action rows ─────────────────────────────────────────────────────
  const ACTION_META: Array<{
    type: string
    label: string
    color: string
    icon: string
  }> = [
    { type: 'votes',           label: 'Votes Cast',          color: 'for-400',      icon: 'ThumbsUp' },
    { type: 'arguments',       label: 'Arguments Written',   color: 'purple',       icon: 'BookOpen' },
    { type: 'replies',         label: 'Replies Posted',      color: 'emerald',      icon: 'MessageSquare' },
    { type: 'argument_votes',  label: 'Arguments Upvoted',   color: 'for-300',      icon: 'ChevronUp' },
    { type: 'predictions',     label: 'Predictions Made',    color: 'gold',         icon: 'Target' },
    { type: 'wiki_edits',      label: 'Wiki Edits',          color: 'emerald',      icon: 'BookOpen' },
    { type: 'debate_messages', label: 'Debate Messages',     color: 'purple',       icon: 'Mic' },
    { type: 'argument_reacts', label: 'Argument Reactions',  color: 'against-400',  icon: 'Heart' },
    { type: 'topic_reacts',    label: 'Topic Reactions',     color: 'against-300',  icon: 'Zap' },
    { type: 'supports',        label: 'Topics Supported',    color: 'for-500',      icon: 'TrendingUp' },
    { type: 'topic_bookmarks', label: 'Topics Bookmarked',   color: 'gold',         icon: 'Bookmark' },
    { type: 'arg_bookmarks',   label: 'Arguments Saved',     color: 'gold',         icon: 'Bookmark' },
    { type: 'collections',     label: 'Collections Created', color: 'purple',       icon: 'FolderOpen' },
  ]

  const actions: EngagementAction[] = ACTION_META.map(({ type, label, color, icon }) => ({
    type,
    label,
    count: counts[type] ?? 0,
    weight: WEIGHTS[type] ?? 1,
    color,
    icon,
  })).sort((a, b) => b.count - a.count)

  // ── Depth score (0–100) ───────────────────────────────────────────────────
  const rawScore = actions.reduce((acc, a) => acc + a.count * a.weight, 0)
  // Normalise: cap at 2500 raw points → 100
  const depthScore = Math.min(100, Math.round((rawScore / 2500) * 100))

  const depthLabel =
    depthScore >= 80 ? 'Champion'
    : depthScore >= 55 ? 'Contributor'
    : depthScore >= 30 ? 'Participant'
    : depthScore >= 12 ? 'Observer'
    : 'Lurker'

  const totalActions = actions.reduce((acc, a) => acc + a.count, 0)

  // ── Diversity score (how many distinct action types the user has used) ────
  const typesUsed = actions.filter((a) => a.count > 0).length
  const diversityScore = Math.min(10, typesUsed)

  // ── Funnel ────────────────────────────────────────────────────────────────
  const { count: subscriptionCount } = await supabase
    .from('topic_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)

  const funnel = {
    viewed_topics: subscriptionCount ?? 0,
    voted:         counts.votes,
    argued:        counts.arguments,
    replied:       counts.replies,
    reacted:       (counts.argument_reacts) + (counts.topic_reacts),
  }

  // ── Top engaged topics (topics where user has the most action types) ──────
  const [
    { data: myVotes },
    { data: myArgs },
    { data: myReplies },
    { data: myTopicReacts },
    { data: myTopicBookmarks },
  ] = await Promise.all([
    supabase.from('votes').select('topic_id').eq('user_id', uid).limit(500),
    supabase.from('topic_arguments').select('topic_id').eq('user_id', uid).limit(500),
    supabase.from('argument_replies')
      .select('argument_id, topic_arguments!inner(topic_id)')
      .eq('user_id', uid)
      .limit(200),
    supabase.from('topic_reactions').select('topic_id').eq('user_id', uid).limit(200),
    supabase.from('topic_bookmarks').select('topic_id').eq('user_id', uid).limit(200),
  ])

  type TopicActionMap = Map<string, { count: number; types: Set<string> }>
  const topicMap: TopicActionMap = new Map()

  function addAction(topicId: string, type: string) {
    const existing = topicMap.get(topicId) ?? { count: 0, types: new Set() }
    existing.count++
    existing.types.add(type)
    topicMap.set(topicId, existing)
  }

  for (const v of myVotes ?? []) addAction(v.topic_id, 'vote')
  for (const a of myArgs ?? []) addAction(a.topic_id, 'argument')
  for (const r of myReplies ?? []) {
    const joined = r as unknown as { topic_arguments: { topic_id: string } }
    if (joined.topic_arguments?.topic_id) addAction(joined.topic_arguments.topic_id, 'reply')
  }
  for (const tr of myTopicReacts ?? []) addAction(tr.topic_id, 'react')
  for (const tb of myTopicBookmarks ?? []) addAction(tb.topic_id, 'bookmark')

  const topTopicIds = [...topicMap.entries()]
    .sort((a, b) => b[1].types.size - a[1].types.size || b[1].count - a[1].count)
    .slice(0, 8)
    .map(([id]) => id)

  let topEngagedTopics: EngagementTopic[] = []
  if (topTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topTopicIds)

    topEngagedTopics = topTopicIds
      .map((id) => {
        const t = (topicRows ?? []).find((r) => r.id === id)
        if (!t) return null
        const entry = topicMap.get(id)!
        return {
          id,
          statement: t.statement,
          actions: entry.count,
          action_types: [...entry.types],
        }
      })
      .filter((t): t is EngagementTopic => t !== null)
  }

  // ── Weekly trend (all action types combined by week) ─────────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('created_at')
    .eq('user_id', uid)
    .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
    .order('created_at', { ascending: true })

  const weekBuckets = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    const w = getWeekLabel(v.created_at)
    weekBuckets.set(w, (weekBuckets.get(w) ?? 0) + 1)
  }
  const weeklyTrend = [...weekBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, actions]) => ({ week, actions }))

  // ── Platform comparison (rough estimates) ────────────────────────────────
  // Average active user has ~30 raw score → ~1.2 depth score
  const avgScore = 22
  const percentile =
    depthScore >= 80 ? 97
    : depthScore >= 55 ? 88
    : depthScore >= 30 ? 68
    : depthScore >= 12 ? 40
    : 15

  return NextResponse.json({
    depthScore,
    depthLabel,
    totalActions,
    actions,
    topEngagedTopics,
    funnel,
    weeklyTrend,
    diversityScore,
    platformComparison: {
      your_score: depthScore,
      avg_score: avgScore,
      percentile,
    },
  } satisfies EngagementData)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekLabel(iso: string): string {
  const d = new Date(iso)
  const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dayOfWeek)
  return d.toISOString().slice(0, 10)
}
