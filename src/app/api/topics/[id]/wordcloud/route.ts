import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Stop-word list ───────────────────────────────────────────────────────────

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
  'that','this','these','those','here','there','yes','no','not',
])

const MIN_WORD_LEN = 3
const TOP_N = 40

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    // Keep hyphens inside compound words, strip everything else
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, '')) // trim leading/trailing hyphens
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

export interface WordEntry {
  word: string
  count: number
  /** Normalised 0–1 weight within the side's own top-N */
  weight: number
}

export interface WordCloudResponse {
  for:     WordEntry[]
  against: WordEntry[]
  total_for_args:     number
  total_against_args: number
  error?: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_arguments')
    .select('side, content')
    .eq('topic_id', params.id)
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' } satisfies WordCloudResponse, {
      status: 500,
    })
  }

  const rows = (data ?? []) as { side: 'blue' | 'red'; content: string }[]

  const forTexts     = rows.filter((r) => r.side === 'blue').map((r) => r.content)
  const againstTexts = rows.filter((r) => r.side === 'red').map((r)  => r.content)

  const forCounts     = countWords(forTexts)
  const againstCounts = countWords(againstTexts)

  function toEntries(counts: Record<string, number>): WordEntry[] {
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

  const response: WordCloudResponse = {
    for:     toEntries(forCounts),
    against: toEntries(againstCounts),
    total_for_args:     forTexts.length,
    total_against_args: againstTexts.length,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
