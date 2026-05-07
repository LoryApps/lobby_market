import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, GitBranch, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagGraphClient } from './TagGraphClient'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Tag Network · Lobby Market',
  description:
    'A force-directed network of every civic debate tag — see which topics cluster together and which tags span multiple policy areas.',
  openGraph: {
    title: 'Tag Network · Lobby Market',
    description:
      'Explore how civic debate tags interconnect across the Lobby — clusters reveal the hidden structure of public opinion.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Tag Network · Lobby Market',
    description: 'Force-directed map of all civic debate tags and their connections.',
  },
}

// ─── Types (inline to avoid re-importing from API) ────────────────────────────

interface TagNode {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
}

interface TagEdge {
  source: string
  target: string
  weight: number
}

// ─── Data fetching (server-side for speed) ────────────────────────────────────

async function fetchGraphData(): Promise<{ nodes: TagNode[]; edges: TagEdge[]; topicCount: number }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('tags, status, total_votes')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(1500)

  if (error || !data) return { nodes: [], edges: [], topicCount: 0 }

  // Build node stats
  const nodeMap = new Map<string, TagNode>()
  for (const row of data) {
    const tags: string[] = row.tags ?? []
    for (const tag of tags) {
      if (!tag) continue
      const n = nodeMap.get(tag) ?? { tag, topic_count: 0, law_count: 0, active_count: 0, total_votes: 0 }
      n.topic_count++
      n.total_votes += row.total_votes ?? 0
      if (row.status === 'law') n.law_count++
      if (row.status === 'active' || row.status === 'voting') n.active_count++
      nodeMap.set(tag, n)
    }
  }

  const nodes = Array.from(nodeMap.values())
    .filter((n) => n.topic_count >= 2)
    .sort((a, b) => b.topic_count - a.topic_count)
    .slice(0, 80)

  const nodeSet = new Set(nodes.map((n) => n.tag))

  // Build co-occurrence edges
  const edgeMap = new Map<string, number>()
  for (const row of data) {
    const tags: string[] = (row.tags ?? []).filter((t: string) => nodeSet.has(t))
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = tags[i] < tags[j] ? `${tags[i]}|${tags[j]}` : `${tags[j]}|${tags[i]}`
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
      }
    }
  }

  const edges: TagEdge[] = Array.from(edgeMap.entries())
    .filter(([, w]) => w >= 2)
    .map(([key, weight]) => {
      const [source, target] = key.split('|')
      return { source, target, weight }
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 200)

  return { nodes, edges, topicCount: data.length }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TagGraphPage() {
  const { nodes, edges, topicCount } = await fetchGraphData()

  const lawTagCount = nodes.filter((n) => n.law_count > 0).length
  const activeTagCount = nodes.filter((n) => n.active_count > 0).length

  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <TopBar />
        <div className="max-w-[1400px] mx-auto flex items-center h-12 px-4 gap-3">
          {/* Back */}
          <Link
            href="/tags"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to Tags"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Network className="h-4 w-4 text-for-400 flex-shrink-0" />
            <span className="text-sm font-mono text-surface-300 truncate">
              Tag Network
            </span>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-3 ml-2 flex-shrink-0 text-[11px] font-mono">
            <span className="text-surface-500">{nodes.length} tags</span>
            <span className="text-surface-600">·</span>
            <span className="text-surface-500">{edges.length} connections</span>
            {lawTagCount > 0 && (
              <>
                <span className="text-surface-600">·</span>
                <span className="text-gold">{lawTagCount} with laws</span>
              </>
            )}
            {activeTagCount > 0 && (
              <>
                <span className="text-surface-600">·</span>
                <span className="text-for-400">{activeTagCount} active</span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <Link
              href="/topic/graph"
              className="text-[11px] font-mono text-purple hover:text-purple/80 transition-colors"
            >
              Topic Graph →
            </Link>
            <span className="text-surface-600 text-[11px]">·</span>
            <Link
              href="/law/graph"
              className="text-[11px] font-mono text-emerald hover:text-emerald/80 transition-colors"
            >
              Law Graph →
            </Link>
          </div>
        </div>
      </div>

      {/* Graph or empty state */}
      {nodes.length === 0 ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            icon={GitBranch}
            title="No tag connections yet"
            description="Tag co-occurrences will appear here once topics carry multiple tags."
            actions={[
              { label: 'Browse tags', href: '/tags' },
              { label: 'Explore topics', href: '/' },
            ]}
          />
        </main>
      ) : (
        <main className="flex-1 overflow-hidden min-h-0 pb-16 md:pb-0">
          <TagGraphClient
            nodes={nodes}
            edges={edges}
            topicCount={topicCount}
            className="h-full"
          />
        </main>
      )}

      <BottomNav />
    </div>
  )
}
