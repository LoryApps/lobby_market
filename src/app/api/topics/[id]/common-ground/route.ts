import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NuancedArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  nuance_score: number          // 0–100: how much concession/bridge language
  highlighted_phrases: string[] // phrases that indicate nuance/common ground
}

export interface SharedTheme {
  phrase: string
  for_count: number
  against_count: number
  total: number
}

export interface CommonGroundResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  common_ground_score: number  // 0–100 aggregate civility/nuance score
  nuanced_for: NuancedArgument[]
  nuanced_against: NuancedArgument[]
  shared_themes: SharedTheme[]
  total_for: number
  total_against: number
  nuance_for_pct: number   // % of FOR args that acknowledge the other side
  nuance_against_pct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Phrases that indicate the author acknowledges the opposing view
const CONCESSION_PATTERNS = [
  /\b(however|although|while|even if|even though|despite|granted|admittedly)\b/gi,
  /\b(to be fair|fair enough|fair point|i understand|i acknowledge|i agree that)\b/gi,
  /\b(both sides|common ground|we can agree|everyone agrees|most people agree)\b/gi,
  /\b(the concern is valid|the concern about|legitimate concern|valid point)\b/gi,
  /\b(on the other hand|at the same time|that said|having said that|even so)\b/gi,
  /\b(nuanced|balanced|both|middle ground|compromise|neither extreme)\b/gi,
  /\b(not all|not every|more complex|complicated|it depends|context matters)\b/gi,
  /\b(true that|you're right that|one can argue|one could argue|some would say)\b/gi,
  /\b(yes, but|yes and|while valid|while true|while understandable)\b/gi,
]

function computeNuanceScore(content: string): { score: number; phrases: string[] } {
  const lower = content.toLowerCase()
  const matches: string[] = []

  for (const pattern of CONCESSION_PATTERNS) {
    const found = lower.match(pattern)
    if (found) {
      matches.push(...found.map((m) => m.trim()))
    }
    pattern.lastIndex = 0
  }

  const unique = Array.from(new Set(matches))
  // Score: each unique concession phrase adds ~20 points, capped at 100
  const raw = Math.min(100, unique.length * 20)
  return { score: raw, phrases: unique.slice(0, 5) }
}

// Extract 2-3 word phrases from text that might represent themes
function extractPhrases(text: string): string[] {
  // Strip punctuation, lowercase
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ')
  const words = clean.split(/\s+/).filter((w) => w.length > 3)

  // Bigrams
  const bigrams: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`)
  }

  // Filter out very common bigrams (stopword pairs)
  const STOP_BIGRAMS = new Set([
    'that the', 'in the', 'of the', 'to the', 'is the', 'and the',
    'for the', 'on the', 'this is', 'it is', 'there is', 'we are',
    'to be', 'will be', 'can be', 'should be', 'would be', 'have been',
    'there are', 'they are', 'we need', 'you can', 'this will',
    'does not', 'do not', 'cannot', 'can not', 'will not',
  ])

  return bigrams.filter((b) => !STOP_BIGRAMS.has(b))
}

function findSharedThemes(
  forArgs: { content: string }[],
  againstArgs: { content: string }[],
): SharedTheme[] {
  const forPhraseCount = new Map<string, number>()
  const againstPhraseCount = new Map<string, number>()

  for (const a of forArgs) {
    for (const phrase of extractPhrases(a.content)) {
      forPhraseCount.set(phrase, (forPhraseCount.get(phrase) ?? 0) + 1)
    }
  }
  for (const a of againstArgs) {
    for (const phrase of extractPhrases(a.content)) {
      againstPhraseCount.set(phrase, (againstPhraseCount.get(phrase) ?? 0) + 1)
    }
  }

  const shared: SharedTheme[] = []
  for (const [phrase, forCount] of forPhraseCount) {
    const againstCount = againstPhraseCount.get(phrase) ?? 0
    // Must appear in both sides
    if (againstCount > 0 && forCount + againstCount >= 3) {
      shared.push({ phrase, for_count: forCount, against_count: againstCount, total: forCount + againstCount })
    }
  }

  // Sort by total appearances, return top 20
  return shared
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)
    .filter((t) => t.total >= 2)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch top 30 arguments from each side by upvotes
  const [{ data: forRows }, { data: againstRows }] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, side, content, upvotes, ai_grade, created_at, user_id')
      .eq('topic_id', params.id)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(30),
    supabase
      .from('topic_arguments')
      .select('id, side, content, upvotes, ai_grade, created_at, user_id')
      .eq('topic_id', params.id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(30),
  ])

  const forArgs = forRows ?? []
  const againstArgs = againstRows ?? []

  // Collect all unique author IDs
  const allArgs = [...forArgs, ...againstArgs]
  const authorIds = Array.from(new Set(allArgs.map((a) => a.user_id).filter(Boolean)))

  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Score each argument for nuance
  function toNuanced(
    a: typeof allArgs[0],
  ): NuancedArgument {
    const { score, phrases } = computeNuanceScore(a.content)
    const author = profileMap.get(a.user_id)
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      ai_grade: a.ai_grade ?? null,
      created_at: a.created_at,
      author: author
        ? {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
          }
        : null,
      nuance_score: score,
      highlighted_phrases: phrases,
    }
  }

  const scoredFor = forArgs.map(toNuanced)
  const scoredAgainst = againstArgs.map(toNuanced)

  // Filter to nuanced arguments (score >= 20), sorted by nuance_score desc
  const nuancedFor = scoredFor
    .filter((a) => a.nuance_score >= 20)
    .sort((a, b) => b.nuance_score - a.nuance_score)
    .slice(0, 10)

  const nuancedAgainst = scoredAgainst
    .filter((a) => a.nuance_score >= 20)
    .sort((a, b) => b.nuance_score - a.nuance_score)
    .slice(0, 10)

  // Shared themes across both sides
  const sharedThemes = findSharedThemes(forArgs, againstArgs)

  // Common Ground Score:
  //   40% weight: share of nuanced arguments (both sides avg)
  //   30% weight: shared theme density
  //   30% weight: rebalanced by topic consensus distance from 50%
  const nuanceForPct = forArgs.length > 0 ? (nuancedFor.length / forArgs.length) * 100 : 0
  const nuanceAgainstPct = againstArgs.length > 0 ? (nuancedAgainst.length / againstArgs.length) * 100 : 0
  const avgNuancePct = (nuanceForPct + nuanceAgainstPct) / 2

  const themeDensity = Math.min(100, sharedThemes.length * 5) // up to 20 themes = 100

  // Topics near 50/50 are more contested, so common ground is harder (discount slightly)
  const polarization = Math.abs((topic.blue_pct ?? 50) - 50) / 50 // 0 = totally split, 1 = total consensus
  const consensusFactor = 1 - polarization * 0.3 // slight bonus for contested topics having bridge args

  const commonGroundScore = Math.round(
    (avgNuancePct * 0.4 + themeDensity * 0.3 + 30 * consensusFactor) *
      (allArgs.length > 5 ? 1 : 0.5), // penalty for very thin debates
  )

  return NextResponse.json({
    topic,
    common_ground_score: Math.min(100, Math.max(0, commonGroundScore)),
    nuanced_for: nuancedFor,
    nuanced_against: nuancedAgainst,
    shared_themes: sharedThemes,
    total_for: forArgs.length,
    total_against: againstArgs.length,
    nuance_for_pct: Math.round(nuanceForPct),
    nuance_against_pct: Math.round(nuanceAgainstPct),
  } satisfies CommonGroundResponse)
}
