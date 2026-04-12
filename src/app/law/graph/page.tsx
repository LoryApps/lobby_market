import Link from 'next/link'
import { ArrowLeft, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LawGraph } from '@/components/law/LawGraph'
import { cn } from '@/lib/utils/cn'
import type { Law, LawLink } from '@/lib/supabase/types'

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
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/law"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors'
            )}
            aria-label="Back to Codex"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald" />
            <span className="text-sm font-mono text-surface-700">
              Codex · Full Graph
            </span>
          </div>
          <span className="ml-auto text-xs font-mono text-surface-500">
            {laws.length} Laws
          </span>
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6">
        <LawGraph
          laws={laws}
          links={links}
          className="w-full h-[calc(100vh-8rem)] aspect-auto"
        />
      </main>
    </div>
  )
}
