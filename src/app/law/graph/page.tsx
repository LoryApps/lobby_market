import Link from 'next/link'
import { ArrowLeft, Clock, FileText, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LawGraphView } from '@/components/law/LawGraphView'
import { cn } from '@/lib/utils/cn'
import type { Law, LawLink } from '@/lib/supabase/types'

export const metadata = {
  title: 'Law Graph · Lobby Market',
  description: 'Interactive knowledge graph of all established consensus laws.',
}

export const dynamic = 'force-dynamic'

export default async function LawFullGraphPage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('*')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const { data: linkRows } = await supabase.from('law_links').select('*')

  const laws = (lawRows as Law[] | null) ?? []
  const links = (linkRows as LawLink[] | null) ?? []

  return (
    <div className="h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/law"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Back to Codex"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald" />
            <span className="text-sm font-mono text-surface-700">
              Codex · Knowledge Graph
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-surface-500">
            <span>{laws.length} laws</span>
            <span className="text-surface-600">·</span>
            <span>{links.length} connections</span>
            <span className="text-surface-600">·</span>
            <Link
              href="/law/timeline"
              className="flex items-center gap-1 text-surface-500 hover:text-white transition-colors"
            >
              <Clock className="h-3 w-3" />
              Timeline →
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/topic/graph"
              className="flex items-center gap-1 text-for-400 hover:text-for-300 transition-colors"
            >
              <FileText className="h-3 w-3" />
              Topic Network →
            </Link>
          </div>
        </div>
      </div>

      {/* Main: controls + graph, fills remaining height */}
      <main className="flex-1 overflow-hidden p-4 md:p-5">
        <LawGraphView
          laws={laws}
          links={links}
          graphClassName="h-full"
        />
      </main>
    </div>
  )
}
