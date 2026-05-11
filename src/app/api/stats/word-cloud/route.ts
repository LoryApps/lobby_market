import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Stop-word list ────────────────────────────────────────────────────────────

const STOP = new Set([
  'the','be','to','of','and','a','in','that','have','it','for','not','on',
  'with','as','you','do','at','this','but','by','from','they','we','say',
  'her','she','or','an','will','my','one','all','would','there','their',
  'what','so','up','out','if','about','who','get','which','go','me','when',
  'make','can','like','time','no','just','him','know','take','into','year',
  'your','good','some','could','them','see','other','than','then','now',
  'look','only','come','its','over','think','also','back','after','use',
  'two','how','our','work','first','well','way','even','new','want','because',
  'any','these','give','day','most','us','is','are','was','were','been',
  'has','had','does','did','being','very','should','more','such','much',
  'many','those','through','while','here','both','between','same','under',
  'never','always','own','another','without','where','every','each','either',
  'neither','might','may','must','shall','done','using','used','still','own',
  'however','therefore','thus','hence','since','though','although','despite',
  'instead','rather','unless','whether','while','whereas','whereby','yet',
  'further','moreover','furthermore','indeed','certainly','simply','clearly',
  'obviously','already','often','always','never','perhaps','maybe','actually',
  'really','quite','rather','very','too','also','just','even','only','both',
  'each','few','more','most','other','some','such','than','then','when',
  'where','which','who','whom','whose','why','how','all','any','both','each',
  'few','many','several','some','per','via','without','within','between',
  're','ve','ll','d','m','s','t','isn','aren','wasn','weren','hasn','haven',
  'hadn','doesn','don','didn','won','wouldn','couldn','shouldn','needn',
  'that','this','these','those','here','there','yes','no','not','people',
  'need','make','take','like','well','will','also','just','even','back',
  'because','their','there','would','could','should','about','when','than',
  'more','into','from','have','this','with','they','what','been','were',
  'much','said','says','says','say','get','had','has','does','did','its',
  'i','ii','iii','iv','v','vi','vii','viii','ix','x',
])

const MIN_WORD_LEN = 3
const TOP_N = 60

const VALID_CATEGORIES = [
  'Economics','Politics','Technology','Science','Ethics',
  'Philosophy','Culture','Health','Environment','Education',
]

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformWordEntry {
  word: string
  count: number
  weight: number
}

export interface PlatformWordCloudResponse {
  for: PlatformWordEntry[]
  against: PlatformWordEntry[]
  total_for_args: number
  total_against_args: number
  category: string | null
  days: number | null
  generatedAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= MIN_WORD_LEN && !STOP.has(w) && !/^\d+$/.test(w))
}

function countWords(texts: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const text of texts) {
    for (const word of tokenise(text)) {
      counts[word] = (counts[word] ?? 0) + 1
    }
  }
  return counts
}

function toEntries(counts: Record<string, number>): PlatformWordEntry[] {
  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_N)
  const max = sorted[0]?.[1] ?? 1
  return sorted.map(([word, count]) => ({
    word,
    count,
    weight: count / max,
  }))
}

// ─── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/word-cloud
 *
 * Returns the most-used words across all platform arguments, split by
 * FOR (blue) and AGAINST (red).
 *
 * Query params:
 *   category — filter by category (optional)
 *   days     — 7 | 30 | 0=all-time (default: 30)
 *   limit    — max arguments to process, 100–3000 (default: 2000)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const rawCategory = searchParams.get('category') ?? ''
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''

  const rawDays = parseInt(searchParams.get('days') ?? '30', 10)
  const days = [7, 30, 0].includes(rawDays) ? rawDays : 30

  const rawLimit = parseInt(searchParams.get('limit') ?? '2000', 10)
  const limit = Math.min(3000, Math.max(100, isNaN(rawLimit) ? 2000 : rawLimit))

  const supabase = await createClient()

  // Build the arguments query
  let argsQuery = supabase
    .from('topic_arguments')
    .select('id, side, content, topic_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (days > 0) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    argsQuery = argsQuery.gte('created_at', since.toISOString())
  }

  const { data: rawArgs, error: argsError } = await argsQuery

  if (argsError) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  // If category filter is set, fetch matching topic IDs first
  let validTopicIds: Set<string> | null = null
  if (category) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id')
      .eq('category', category)
    if (topicRows) {
      validTopicIds = new Set(topicRows.map((t) => t.id))
    }
  }

  // Filter by category if needed
  const filtered = validTopicIds
    ? args.filter((a) => validTopicIds!.has(a.topic_id))
    : args

  const forTexts = filtered.filter((a) => a.side === 'blue').map((a) => a.content)
  const againstTexts = filtered.filter((a) => a.side === 'red').map((a) => a.content)

  const forCounts = countWords(forTexts)
  const againstCounts = countWords(againstTexts)

  const response: PlatformWordCloudResponse = {
    for: toEntries(forCounts),
    against: toEntries(againstCounts),
    total_for_args: forTexts.length,
    total_against_args: againstTexts.length,
    category: category || null,
    days: days || null,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
  })
}
