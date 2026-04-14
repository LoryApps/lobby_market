import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopicGraphView } from '@/components/topic/TopicGraphView'
import type { TopicNode, TopicEdge } from '@/components/topic/TopicGraph'
import type { Topic } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Topic Network · Lobby Market',
  description:
    'Interactive network graph of all debate topics — explore how ideas cluster by category, see vote splits at a glance, and navigate straight to any debate.',
  openGraph: {
    title: 'Topic Network · Lobby Market',
    description: 'Explore the full map of debates in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export const dynamic = 'force-dynamic'

// ─── Edge computation ─────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'will', 'should', 'would', 'could',
  'been', 'were', 'they', 'them', 'their', 'than', 'then', 'when', 'what',
  'which', 'where', 'into', 'your', 'more', 'very', 'also', 'just', 'only',
  'some', 'most', 'over', 'such', 'each', 'about', 'after', 'before', 'being',
  'between', 'other', 'there', 'these', 'those', 'while', 'without', 'through',
  'during', 'always', 'never', 'every', 'even', 'must', 'need', 'make', 'made',
  'used', 'uses', 'using', 'like', 'likely', 'people', 'government',
])

const MIN_WORD_LEN = 4
const MAX_WORDS_PER_TOPIC = 10
const MAX_EDGES_PER_NODE = 4

function extractKeywords(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN && !STOP_WORDS.has(w))
    .slice(0, MAX_WORDS_PER_TOPIC)
}

function computeEdges(topics: TopicNode[]): TopicEdge[] {
  // Build keyword arrays for each topic
  const keywordArrays = topics.map((t) => extractKeywords(t.statement))

  // Build inverted index: keyword → topic indices
  const invertedIndex = new Map<string, number[]>()
  for (let i = 0; i < topics.length; i++) {
    for (const word of keywordArrays[i]) {
      const list = invertedIndex.get(word)
      if (list) list.push(i)
      else invertedIndex.set(word, [i])
    }
  }

  // Count shared keywords per pair (only via the inverted index — O(V*W) not O(V²))
  const pairWeights = new Map<string, number>()
  const allIndicesLists = Array.from(invertedIndex.values())
  for (const indices of allIndicesLists) {
    if (indices.length < 2 || indices.length > 80) continue // skip too-common words
    for (let a = 0; a < indices.length - 1; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a]
        const j = indices[b]
        const key = i < j ? `${i}:${j}` : `${j}:${i}`
        pairWeights.set(key, (pairWeights.get(key) ?? 0) + 1)
      }
    }
  }

  // Filter pairs and build edge list
  // Threshold: same category → 1 shared keyword; different category → 2 shared keywords
  const edgesByNode: Map<number, Array<{ j: number; weight: number }>> = new Map()

  const allPairs = Array.from(pairWeights.entries())
  for (const [key, weight] of allPairs) {
    const parts = key.split(':')
    const ai = parseInt(parts[0], 10)
    const bi = parseInt(parts[1], 10)
    const sameCategory =
      topics[ai].category !== null &&
      topics[ai].category === topics[bi].category

    const threshold = sameCategory ? 1 : 2
    if (weight < threshold) continue

    const aList = edgesByNode.get(ai) ?? []
    aList.push({ j: bi, weight })
    edgesByNode.set(ai, aList)

    const bList = edgesByNode.get(bi) ?? []
    bList.push({ j: ai, weight })
    edgesByNode.set(bi, bList)
  }

  // Keep only the top MAX_EDGES_PER_NODE strongest edges per node
  const keptEdgesArr: string[] = []
  const keptEdgesSet = new Set<string>()

  const allNodeNeighbors = Array.from(edgesByNode.entries())
  for (const [i, neighbors] of allNodeNeighbors) {
    neighbors.sort((a, b) => b.weight - a.weight)
    for (let k = 0; k < Math.min(neighbors.length, MAX_EDGES_PER_NODE); k++) {
      const j = neighbors[k].j
      const edgeKey = i < j ? `${i}:${j}` : `${j}:${i}`
      if (!keptEdgesSet.has(edgeKey)) {
        keptEdgesSet.add(edgeKey)
        keptEdgesArr.push(edgeKey)
      }
    }
  }

  // Convert to TopicEdge[]
  const edges: TopicEdge[] = []
  for (const key of keptEdgesArr) {
    const parts = key.split(':')
    const ai = parseInt(parts[0], 10)
    const bi = parseInt(parts[1], 10)
    const minKey = ai < bi ? `${ai}:${bi}` : `${bi}:${ai}`
    const weight = pairWeights.get(minKey) ?? 1
    edges.push({
      source: topics[ai].id,
      target: topics[bi].id,
      weight: Math.min(weight, 5), // cap visual weight
    })
  }

  return edges
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TopicGraphPage() {
  const supabase = await createClient()

  // Fetch all non-failed topics (up to 300 — enough for a rich graph)
  const { data: rawTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct')
    .not('status', 'in', '(failed,archived)')
    .order('feed_score', { ascending: false })
    .limit(300)

  const topicRows = (rawTopics as Pick<
    Topic,
    'id' | 'statement' | 'category' | 'status' | 'total_votes' | 'blue_pct'
  >[] | null) ?? []

  const topics: TopicNode[] = topicRows.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    total_votes: t.total_votes,
    blue_pct: t.blue_pct,
  }))

  const edges = computeEdges(topics)

  // Compute summary stats for the header
  const statusCounts = topics.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/topic/categories"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Back to Categories"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <Network className="h-4 w-4 text-for-400 flex-shrink-0" />
            <span className="text-sm font-mono text-surface-700 truncate">
              Topic Network
            </span>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2 ml-2 flex-shrink-0">
            {[
              { label: 'Active',  count: statusCounts['active']   ?? 0, color: 'text-for-400' },
              { label: 'Voting',  count: statusCounts['voting']   ?? 0, color: 'text-purple' },
              { label: 'LAW',     count: statusCounts['law']      ?? 0, color: 'text-gold' },
              { label: 'Proposed',count: statusCounts['proposed'] ?? 0, color: 'text-surface-500' },
            ]
              .filter((s) => s.count > 0)
              .map((s) => (
                <span
                  key={s.label}
                  className={cn('text-[11px] font-mono flex-shrink-0', s.color)}
                >
                  {s.count} {s.label}
                </span>
              ))}
          </div>

          <div className="ml-auto flex items-center gap-3 flex-shrink-0 text-xs font-mono text-surface-500">
            <span className="hidden sm:block">{topics.length} topics</span>
            <span className="text-surface-600">·</span>
            <span className="hidden sm:block">{edges.length} connections</span>
            <span className="text-surface-600">·</span>
            <Link
              href="/law/graph"
              className="text-emerald hover:text-emerald/80 transition-colors"
            >
              Law Graph →
            </Link>
          </div>
        </div>
      </div>

      {/* Main graph */}
      <main className="flex-1 overflow-hidden p-3 md:p-5 min-h-0">
        <TopicGraphView
          topics={topics}
          edges={edges}
          graphClassName="h-full"
        />
      </main>
    </div>
  )
}
