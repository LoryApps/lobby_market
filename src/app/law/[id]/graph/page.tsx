import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LawGraphView } from '@/components/law/LawGraphView'
import { cn } from '@/lib/utils/cn'
import type { Law, LawLink } from '@/lib/supabase/types'

interface LawGraphPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: LawGraphPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Knowledge Graph · Lobby Market' }

  const stmt: string = law.statement ?? ''
  return {
    title: `Knowledge Graph — ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`,
    description: `Interactive knowledge graph showing how this law connects to related legislation in the Lobby Codex. Explore civic connections by category.`,
    openGraph: {
      title: `Knowledge Graph — ${stmt.slice(0, 70)} · Lobby Market`,
      description: `Explore how this law connects to the rest of the Codex.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default async function LawGraphPage({ params }: LawGraphPageProps) {
  const supabase = await createClient()

  // Fetch the central law
  const { data: centralLaw, error } = await supabase
    .from('laws')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !centralLaw) {
    notFound()
  }

  const lawId = (centralLaw as Law).id

  // 1-hop links (either direction)
  const { data: outLinks } = await supabase
    .from('law_links')
    .select('*')
    .eq('source_law_id', lawId)

  const { data: inLinks } = await supabase
    .from('law_links')
    .select('*')
    .eq('target_law_id', lawId)

  const oneHopIds = new Set<string>([lawId])
  ;(outLinks as LawLink[] | null)?.forEach((l) => oneHopIds.add(l.target_law_id))
  ;(inLinks as LawLink[] | null)?.forEach((l) => oneHopIds.add(l.source_law_id))

  // 2-hop expansion
  const oneHopArray = Array.from(oneHopIds)
  const { data: secondHopOut } = await supabase
    .from('law_links')
    .select('*')
    .in('source_law_id', oneHopArray)

  const { data: secondHopIn } = await supabase
    .from('law_links')
    .select('*')
    .in('target_law_id', oneHopArray)

  const allIds = new Set<string>(oneHopIds)
  ;(secondHopOut as LawLink[] | null)?.forEach((l) => {
    allIds.add(l.source_law_id)
    allIds.add(l.target_law_id)
  })
  ;(secondHopIn as LawLink[] | null)?.forEach((l) => {
    allIds.add(l.source_law_id)
    allIds.add(l.target_law_id)
  })

  // Fetch all laws in the graph
  const { data: lawRows } = await supabase
    .from('laws')
    .select('*')
    .in('id', Array.from(allIds))

  const laws = (lawRows as Law[] | null) ?? []

  // All links where both endpoints are in the graph
  const allLinks: LawLink[] = []
  const seen = new Set<string>()
  const push = (rows: LawLink[] | null | undefined) => {
    if (!rows) return
    for (const l of rows) {
      if (seen.has(l.id)) continue
      if (allIds.has(l.source_law_id) && allIds.has(l.target_law_id)) {
        seen.add(l.id)
        allLinks.push(l)
      }
    }
  }
  push(outLinks as LawLink[] | null)
  push(inLinks as LawLink[] | null)
  push(secondHopOut as LawLink[] | null)
  push(secondHopIn as LawLink[] | null)

  return (
    <div className="h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href={`/law/${params.id}`}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Back to Law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald" />
            <span className="text-sm font-mono text-surface-700">
              Knowledge Graph
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs font-mono text-surface-500">
            <span className="hidden sm:inline line-clamp-1 max-w-[300px]">
              {(centralLaw as Law).statement}
            </span>
            <span className="hidden sm:inline text-surface-600">·</span>
            <Link
              href="/law/graph"
              className="flex items-center gap-1 text-emerald hover:text-emerald/80 transition-colors whitespace-nowrap"
            >
              <Network className="h-3 w-3" aria-hidden />
              Full Codex
            </Link>
          </div>
        </div>
      </div>

      {/* Controls + graph, fills remaining height */}
      <main className="flex-1 overflow-hidden p-4 md:p-5">
        <LawGraphView
          laws={laws}
          links={allLinks}
          currentLawId={lawId}
          graphClassName="h-full"
        />
      </main>
    </div>
  )
}
