import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowthTask {
  title: string
  description: string
  action_label: string
  action_href: string
  estimated_clout: number
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
}

export interface GrowthDimension {
  id: string
  label: string
  score: number
  max_score: number
  pct: number
  color: string
  gap: number
  tasks: GrowthTask[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface GrowthPlanData {
  overall_score: number
  overall_pct: number
  tier: string
  tier_color: string
  top_strength: string
  biggest_opportunity: string
  weekly_goal: string
  dimensions: GrowthDimension[]
  quick_wins: GrowthTask[]
  profile: {
    total_votes: number
    total_arguments: number
    vote_streak: number
    predictions_resolved: number
    prediction_accuracy: number | null
    unique_categories: number
    followers: number
    member_days: number
  }
  generated_at: string
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function priorityFromGap(gap: number, pct: number): GrowthDimension['priority'] {
  if (pct < 30 && gap > 10) return 'critical'
  if (pct < 50 && gap > 7) return 'high'
  if (pct < 70) return 'medium'
  return 'low'
}

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string' || !s.trim()) return fallback
  return s.slice(0, max)
}

function ensureTasks(val: unknown): GrowthTask[] {
  if (!Array.isArray(val)) return []
  const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard'])
  return val
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
    .slice(0, 4)
    .map((t) => ({
      title: clampStr(t.title, 80, 'Complete a civic task'),
      description: clampStr(t.description, 300, ''),
      action_label: clampStr(t.action_label, 40, 'Go'),
      action_href: clampStr(t.action_href, 200, '/'),
      estimated_clout: typeof t.estimated_clout === 'number' ? Math.round(t.estimated_clout) : 5,
      difficulty: (VALID_DIFFICULTY.has(String(t.difficulty)) ? t.difficulty : 'medium') as GrowthTask['difficulty'],
      category: clampStr(t.category, 40, 'General'),
    }))
}

// ─── POST /api/analytics/growth-plan ─────────────────────────────────────────

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch profile and core stats ──────────────────────────────────────
  const [profileRes, argsRes, predictionsRes, votesRes, debatesRes, followsRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('username, display_name, role, total_votes, total_arguments, vote_streak, clout, reputation_score, followers_count, created_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('topic_arguments')
        .select('id, upvotes, source_url, created_at, topics!inner(category)')
        .eq('author_id', user.id),
      supabase
        .from('topic_predictions')
        .select('correct, confidence')
        .eq('user_id', user.id)
        .not('correct', 'is', null),
      supabase
        .from('votes')
        .select('topic_id, created_at, topics!inner(category)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('debate_participants')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', user.id),
    ])

  if (!profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const profile = profileRes.data
  const args = argsRes.data ?? []
  const predictions = predictionsRes.data ?? []
  const votes = votesRes.data ?? []
  const debateCount = debatesRes.count ?? 0
  void followsRes // queried for future use

  const memberDays = Math.max(1, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000))

  // ── 2. Compute karma-style dimension scores ───────────────────────────────

  // Dimension 1: Discourse Quality (0-30)
  const argCount = args.length
  const totalUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const avgUpvotes = argCount > 0 ? totalUpvotes / argCount : 0
  const argCountScore = clamp(Math.round((argCount / 20) * 15), 0, 15)
  const avgUpvoteScore = clamp(Math.round((avgUpvotes / 5) * 15), 0, 15)
  const discourseScore = argCountScore + avgUpvoteScore

  // Dimension 2: Predictive Accuracy (0-20)
  const resolvedCount = predictions.length
  const correctCount = predictions.filter(p => p.correct === true).length
  const winRate = resolvedCount > 0 ? correctCount / resolvedCount : 0
  const predVolumeScore = clamp(Math.round((resolvedCount / 10) * 10), 0, 10)
  const predAccuracyScore = clamp(Math.round(winRate * 10), 0, 10)
  const predictScore = predVolumeScore + predAccuracyScore

  // Dimension 3: Civic Breadth (0-20)
  const categorySet = new Set<string>()
  for (const a of args) {
    const cat = (a.topics as { category: string | null } | null)?.category
    if (cat) categorySet.add(cat)
  }
  for (const v of votes) {
    const cat = (v.topics as { category: string | null } | null)?.category
    if (cat) categorySet.add(cat)
  }
  const uniqueCategories = categorySet.size
  const breadthScore = clamp(uniqueCategories * 2, 0, 20)

  // Dimension 4: Engagement Depth (0-20)
  const voteCount = profile.total_votes ?? 0
  const streakScore = clamp(Math.round(((profile.vote_streak ?? 0) / 7) * 5), 0, 5)
  const voteVolumeScore = clamp(Math.round((voteCount / 50) * 10), 0, 10)
  const debateScore = clamp(debateCount * 5, 0, 5)
  const engagementScore = streakScore + voteVolumeScore + debateScore

  // Dimension 5: Community Trust (0-10)
  const followers = profile.followers_count ?? 0
  const followerScore = clamp(Math.round((followers / 10) * 5), 0, 5)
  const citedCount = args.filter(a => a.source_url).length
  const citedScore = clamp(Math.round((citedCount / Math.max(argCount, 1)) * 5), 0, 5)
  const trustScore = followerScore + citedScore

  const totalScore = discourseScore + predictScore + breadthScore + engagementScore + trustScore
  const maxScore = 100
  const overallPct = Math.round((totalScore / maxScore) * 100)

  function getTier(pct: number) {
    if (pct >= 96) return { tier: 'Civic Champion', color: 'text-gold' }
    if (pct >= 86) return { tier: 'Elder', color: 'text-purple' }
    if (pct >= 71) return { tier: 'Advocate', color: 'text-for-400' }
    if (pct >= 56) return { tier: 'Contributor', color: 'text-emerald' }
    if (pct >= 41) return { tier: 'Participant', color: 'text-for-300' }
    if (pct >= 21) return { tier: 'Observer', color: 'text-surface-500' }
    return { tier: 'Newcomer', color: 'text-surface-400' }
  }

  const { tier, color: tierColor } = getTier(overallPct)

  const rawDimensions = [
    {
      id: 'discourse',
      label: 'Discourse Quality',
      score: discourseScore,
      max_score: 30,
      color: 'text-purple',
      context: `${argCount} argument(s), avg ${avgUpvotes.toFixed(1)} upvotes`,
    },
    {
      id: 'prediction',
      label: 'Predictive Accuracy',
      score: predictScore,
      max_score: 20,
      color: 'text-for-400',
      context: `${resolvedCount} resolved prediction(s), ${Math.round(winRate * 100)}% accuracy`,
    },
    {
      id: 'breadth',
      label: 'Civic Breadth',
      score: breadthScore,
      max_score: 20,
      color: 'text-emerald',
      context: `${uniqueCategories} unique category/categories engaged`,
    },
    {
      id: 'engagement',
      label: 'Engagement Depth',
      score: engagementScore,
      max_score: 20,
      color: 'text-for-300',
      context: `${voteCount} votes, ${profile.vote_streak ?? 0}-day streak, ${debateCount} debate(s)`,
    },
    {
      id: 'trust',
      label: 'Community Trust',
      score: trustScore,
      max_score: 10,
      color: 'text-gold',
      context: `${followers} follower(s), ${citedCount} cited argument(s)`,
    },
  ].map(d => ({
    ...d,
    pct: Math.round((d.score / d.max_score) * 100),
    gap: d.max_score - d.score,
  }))

  // Sort by gap (most room to improve first)
  const sortedByGap = [...rawDimensions].sort((a, b) => b.gap - a.gap)
  const topStrength = [...rawDimensions].sort((a, b) => b.pct - a.pct)[0]
  const biggestOpportunity = sortedByGap[0]

  // ── 3. Generate AI tasks if available ─────────────────────────────────────

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: generate static tasks without AI
    const staticDimensions: GrowthDimension[] = rawDimensions.map(d => ({
      ...d,
      priority: priorityFromGap(d.gap, d.pct),
      tasks: getStaticTasks(d.id, d.pct),
    }))

    const quickWins = staticDimensions
      .flatMap(d => d.tasks.filter(t => t.difficulty === 'easy'))
      .slice(0, 3)

    return NextResponse.json({
      overall_score: totalScore,
      overall_pct: overallPct,
      tier,
      tier_color: tierColor,
      top_strength: topStrength.label,
      biggest_opportunity: biggestOpportunity.label,
      weekly_goal: `Focus on ${biggestOpportunity.label} to unlock the next civic tier`,
      dimensions: staticDimensions,
      quick_wins: quickWins,
      profile: {
        total_votes: voteCount,
        total_arguments: argCount,
        vote_streak: profile.vote_streak ?? 0,
        predictions_resolved: resolvedCount,
        prediction_accuracy: resolvedCount > 0 ? Math.round(winRate * 100) : null,
        unique_categories: uniqueCategories,
        followers,
        member_days: memberDays,
      },
      generated_at: new Date().toISOString(),
    } satisfies GrowthPlanData)
  }

  // ── 4. Build the AI prompt ─────────────────────────────────────────────────
  const weakDimensions = sortedByGap.slice(0, 3)

  const prompt = `You are the Civic Growth Advisor for Lobby Market — a consensus/debate platform where citizens vote on policy topics, write arguments, make predictions, and debate in real-time.

Citizen stats:
- Total votes: ${voteCount}
- Total arguments: ${argCount}
- Current vote streak: ${profile.vote_streak ?? 0} days
- Unique categories engaged: ${uniqueCategories}/10
- Predictions resolved: ${resolvedCount} (${Math.round(winRate * 100)}% accuracy)
- Debates participated: ${debateCount}
- Followers: ${followers}
- Cited arguments: ${citedCount}
- Member for: ${memberDays} days

Current karma scores:
${rawDimensions.map(d => `- ${d.label}: ${d.score}/${d.max_score} (${d.pct}%) — ${d.context}`).join('\n')}

Overall score: ${totalScore}/100 (${overallPct}%) — Tier: ${tier}

The 3 weakest dimensions needing improvement are:
${weakDimensions.map(d => `- ${d.label}: ${d.score}/${d.max_score} (${d.pct}% of max)`).join('\n')}

For each of these 3 weak dimensions, generate exactly 3 specific, actionable tasks a citizen can complete THIS WEEK to improve their score. Tasks must be concrete, not vague. Each task must include a direct link to a specific page on the platform.

Available platform URLs to use in action_href:
- Vote on topics: "/" (home feed)
- Browse topics by category: "/topic/categories"
- Write an argument: click into any topic and write an argument (use "/topics" for discovery)
- Make a prediction: "/predictions"
- Watch a debate: "/debate"
- Join a debate: "/debate" and look for challenges
- Follow other citizens: "/discover" or "/search?tab=people"
- Add citations to arguments: link to your existing arguments
- Explore new categories: "/categories"
- View the oracle for close calls: "/oracle"
- Explore topic by category: "/topic/categories/[Category]" e.g. "/topic/categories/Technology"
- Browse arguments: "/arguments"
- Post in discussions: any topic page "/topic/[id]"

For quick wins, pick tasks that can be completed in under 5 minutes.

Return a JSON object with EXACTLY this shape:
{
  "weekly_goal": "One sentence goal for this week based on weakest dimension",
  "biggest_opportunity_reason": "One sentence explaining why this dimension matters most",
  "dimensions": [
    {
      "dimension_id": "discourse|prediction|breadth|engagement|trust",
      "tasks": [
        {
          "title": "Short task title (max 60 chars)",
          "description": "What to do and why it helps (max 200 chars)",
          "action_label": "Button text (max 25 chars)",
          "action_href": "/exact-platform-url",
          "estimated_clout": 5,
          "difficulty": "easy|medium|hard",
          "category": "Arguments|Predictions|Exploration|Engagement|Community"
        }
      ]
    }
  ],
  "quick_wins": [
    {
      "title": "...",
      "description": "...",
      "action_label": "...",
      "action_href": "...",
      "estimated_clout": 3,
      "difficulty": "easy",
      "category": "..."
    }
  ]
}

Only return valid JSON. Do not include markdown, explanation, or commentary.`

  let aiData: Record<string, unknown> | null = null
  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.startsWith('```') ? raw.replace(/^```json?\n?/, '').replace(/```$/, '').trim() : raw
    aiData = JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    aiData = null
  }

  // ── 5. Merge AI tasks with dimension data ─────────────────────────────────

  const aiDimMap = new Map<string, GrowthTask[]>()
  if (aiData && Array.isArray(aiData.dimensions)) {
    for (const dim of aiData.dimensions as Array<Record<string, unknown>>) {
      const id = String(dim.dimension_id ?? '')
      const tasks = ensureTasks(dim.tasks)
      if (id && tasks.length > 0) aiDimMap.set(id, tasks)
    }
  }

  const dimensions: GrowthDimension[] = rawDimensions.map(d => ({
    ...d,
    priority: priorityFromGap(d.gap, d.pct),
    tasks: aiDimMap.get(d.id) ?? getStaticTasks(d.id, d.pct),
  }))

  const aiQuickWins = aiData && Array.isArray(aiData.quick_wins) ? ensureTasks(aiData.quick_wins) : []
  const quickWins = aiQuickWins.length > 0
    ? aiQuickWins
    : dimensions.flatMap(d => d.tasks.filter(t => t.difficulty === 'easy')).slice(0, 3)

  return NextResponse.json({
    overall_score: totalScore,
    overall_pct: overallPct,
    tier,
    tier_color: tierColor,
    top_strength: topStrength.label,
    biggest_opportunity: biggestOpportunity.label,
    weekly_goal: clampStr(aiData?.weekly_goal, 200, `Strengthen your ${biggestOpportunity.label} this week`),
    dimensions,
    quick_wins: quickWins,
    profile: {
      total_votes: voteCount,
      total_arguments: argCount,
      vote_streak: profile.vote_streak ?? 0,
      predictions_resolved: resolvedCount,
      prediction_accuracy: resolvedCount > 0 ? Math.round(winRate * 100) : null,
      unique_categories: uniqueCategories,
      followers,
      member_days: memberDays,
    },
    generated_at: new Date().toISOString(),
  } satisfies GrowthPlanData)
}

// ─── Static fallback tasks ────────────────────────────────────────────────────

function getStaticTasks(dimensionId: string, pct: number): GrowthTask[] {
  const tasks: Record<string, GrowthTask[]> = {
    discourse: [
      {
        title: 'Write your first argument today',
        description: 'Find an active topic and write a well-reasoned FOR or AGAINST argument. Aim for at least 3 sentences.',
        action_label: 'Browse Topics',
        action_href: '/',
        estimated_clout: 10,
        difficulty: 'easy',
        category: 'Arguments',
      },
      {
        title: 'Add a citation to your argument',
        description: 'Arguments with external sources earn more trust. Find a study or article that supports your position.',
        action_label: 'My Arguments',
        action_href: '/arguments/mine',
        estimated_clout: 8,
        difficulty: 'medium',
        category: 'Arguments',
      },
      {
        title: 'Upvote 5 quality arguments',
        description: 'Engaging with the community signals you\'re an active participant and helps surface the best discourse.',
        action_label: 'Browse Arguments',
        action_href: '/arguments',
        estimated_clout: 5,
        difficulty: 'easy',
        category: 'Arguments',
      },
    ],
    prediction: [
      {
        title: 'Make 3 predictions on active topics',
        description: 'Use the Oracle to find topics with close vote splits — these are most interesting to predict.',
        action_label: 'Make Predictions',
        action_href: '/predictions',
        estimated_clout: 15,
        difficulty: 'easy',
        category: 'Predictions',
      },
      {
        title: 'Study the Oracle before predicting',
        description: 'Review which topics are trending toward law vs. failure. Pattern recognition improves accuracy.',
        action_label: 'View Oracle',
        action_href: '/oracle',
        estimated_clout: 0,
        difficulty: 'easy',
        category: 'Predictions',
      },
      {
        title: 'Check your prediction calibration',
        description: 'Review your past prediction accuracy to identify which topic categories you predict best.',
        action_label: 'Calibration',
        action_href: '/analytics/calibration',
        estimated_clout: 0,
        difficulty: 'easy',
        category: 'Predictions',
      },
    ],
    breadth: [
      {
        title: 'Vote in a new category today',
        description: pct < 30
          ? 'You haven\'t explored many categories yet. Pick a topic outside your comfort zone.'
          : 'Expand your civic voice to an underrepresented category in your history.',
        action_label: 'Browse Categories',
        action_href: '/categories',
        estimated_clout: 8,
        difficulty: 'easy',
        category: 'Exploration',
      },
      {
        title: 'Write an argument in a new category',
        description: 'Cross-category arguments signal a well-rounded civic perspective and increase your breadth score.',
        action_label: 'Explore Topics',
        action_href: '/discover',
        estimated_clout: 12,
        difficulty: 'medium',
        category: 'Exploration',
      },
      {
        title: 'Follow a tag outside your usual sphere',
        description: 'Follow topic tags in underrepresented categories to surface relevant debates in your feed.',
        action_label: 'Browse Tags',
        action_href: '/tags',
        estimated_clout: 3,
        difficulty: 'easy',
        category: 'Exploration',
      },
    ],
    engagement: [
      {
        title: 'Vote on 5 topics today',
        description: 'Consistent daily voting builds your streak and contribution score. Even 5 minutes counts.',
        action_label: 'Start Voting',
        action_href: '/',
        estimated_clout: 10,
        difficulty: 'easy',
        category: 'Engagement',
      },
      {
        title: 'Maintain your streak for 7 days',
        description: 'A 7-day voting streak significantly boosts your engagement score. Mark your calendar.',
        action_label: 'View Streak',
        action_href: '/analytics/streak',
        estimated_clout: 25,
        difficulty: 'hard',
        category: 'Engagement',
      },
      {
        title: 'Join a scheduled debate',
        description: 'Debate participation multiplies your engagement impact. Check the calendar for upcoming events.',
        action_label: 'Debate Calendar',
        action_href: '/debate/calendar',
        estimated_clout: 20,
        difficulty: 'medium',
        category: 'Engagement',
      },
    ],
    trust: [
      {
        title: 'Follow 5 active citizens',
        description: 'Building your network leads to reciprocal follows and community connections.',
        action_label: 'Discover Citizens',
        action_href: '/discover',
        estimated_clout: 5,
        difficulty: 'easy',
        category: 'Community',
      },
      {
        title: 'Share your stance on a topic',
        description: 'Use the stance share button on any topic to share your position with your network.',
        action_label: 'Browse Topics',
        action_href: '/',
        estimated_clout: 5,
        difficulty: 'easy',
        category: 'Community',
      },
      {
        title: 'Add a source to your best argument',
        description: 'Cited arguments earn more upvotes and community trust. Find a credible source.',
        action_label: 'My Arguments',
        action_href: '/arguments/mine',
        estimated_clout: 8,
        difficulty: 'medium',
        category: 'Community',
      },
    ],
  }

  return tasks[dimensionId] ?? []
}
