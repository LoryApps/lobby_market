import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ExternalLink,
  Gavel,
  Scale,
  Tag,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface PageProps {
  params: { tag: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `Laws about #${tag} · Lobby Market`,
    description: `Civic laws established by community consensus on debates tagged "${tag}" on Lobby Market.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}yr ago`
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-600/10',     border: 'border-for-600/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

function catStyle(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-400/30' }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function TagLawsPage({ params }: PageProps) {
  const tag = decodeURIComponent(params.tag)

  const supabase = await createClient()

  // First check if the tag has any topics at all
  const { count: tagCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!tagCount || tagCount === 0) notFound()

  // Get law-status topics tagged with this tag, joined with laws table for establishment date
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, created_at')
    .contains('tags', [tag])
    .eq('status', 'law')
    .order('total_votes', { ascending: false })
    .limit(60)

  const lawTopics = (topicRows ?? []) as {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    created_at: string
  }[]

  // Fetch law table data for these topics to get established_at
  const lawMap = new Map<string, { established_at: string; is_active: boolean }>()
  if (lawTopics.length > 0) {
    const topicIds = lawTopics.map((t) => t.id)
    const { data: lawRows } = await supabase
      .from('laws')
      .select('topic_id, established_at, is_active')
      .in('topic_id', topicIds)
    for (const l of (lawRows ?? []) as { topic_id: string; established_at: string | null; is_active: boolean }[]) {
      lawMap.set(l.topic_id, {
        established_at: l.established_at ?? l.topic_id, // fallback
        is_active: l.is_active,
      })
    }
  }

  // Platform-wide law count for context
  const { count: totalLaws } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* Back */}
        <Link
          href={`/tags/${encodeURIComponent(tag)}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          #{tag}
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="h-4 w-4 text-gold" />
              <h1 className="text-lg font-bold text-white font-mono">
                #{tag} Laws
              </h1>
            </div>
            <p className="text-sm text-surface-500">
              {lawTopics.length} established law{lawTopics.length !== 1 ? 's' : ''} ·{' '}
              <Link
                href="/law"
                className="text-gold hover:text-yellow-300 transition-colors"
              >
                {(totalLaws ?? 0).toLocaleString()} platform-wide
              </Link>
            </p>
          </div>
        </div>

        {/* Law list */}
        {lawTopics.length === 0 ? (
          <EmptyState
            icon={<Gavel className="h-8 w-8" />}
            title="No laws yet"
            description={`No debates tagged #${tag} have reached consensus and become law yet. Keep voting!`}
            actions={[
              { label: `Active #${tag} debates`, href: `/tags/${encodeURIComponent(tag)}/topics?status=active` },
              { label: `All #${tag} topics`, href: `/tags/${encodeURIComponent(tag)}/topics` },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {lawTopics.map((topic, i) => {
              const forPct = Math.round(topic.blue_pct ?? 50)
              const agPct  = 100 - forPct
              const law = lawMap.get(topic.id)
              const cat = catStyle(topic.category)

              return (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="block rounded-2xl bg-surface-100 border border-gold/20 hover:border-gold/40 p-4 transition-all group relative overflow-hidden"
                >
                  {/* Gold accent bar */}
                  <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gold/50" />

                  {/* Rank */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gold font-semibold w-6 flex-shrink-0">
                        #{i + 1}
                      </span>
                      {topic.category && (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                          cat.text, cat.bg, cat.border
                        )}>
                          {topic.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                      <Users className="h-3 w-3" aria-hidden />
                      {topic.total_votes >= 1000
                        ? `${(topic.total_votes / 1000).toFixed(1)}K`
                        : topic.total_votes}{' '}
                      votes
                    </div>
                  </div>

                  {/* Statement */}
                  <p className="text-sm text-white font-semibold leading-snug mb-3 line-clamp-3 group-hover:text-white/90 transition-colors pl-6">
                    {topic.statement}
                  </p>

                  {/* Vote bar */}
                  <div className="pl-6 space-y-1 mb-3">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-for-400 font-semibold">{forPct}% For</span>
                      <span className="text-against-400 font-semibold">{agPct}% Against</span>
                    </div>
                    <div className="relative h-1 rounded-full overflow-hidden bg-surface-300">
                      <div
                        className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
                        style={{ width: `${forPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
                        style={{ width: `${agPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Established date */}
                  <div className="flex items-center justify-between pl-6">
                    {law ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-gold/70">
                        <Calendar className="h-3 w-3" aria-hidden />
                        Established {relativeTime(law.established_at)}
                        {!law.is_active && (
                          <span className="ml-1 text-surface-600">(repealed)</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-gold">
                        <Gavel className="h-3 w-3" aria-hidden />
                        Established
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-gold/60 transition-colors" aria-hidden />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Navigation footer */}
        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <Link
            href="/law"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-mono hover:bg-gold/20 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Full Codex
          </Link>
          <Link
            href={`/tags/${encodeURIComponent(tag)}/topics?status=voting`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple/10 border border-purple/30 text-purple text-xs font-mono hover:bg-purple/20 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            Voting now
          </Link>
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono hover:text-white hover:border-surface-400 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            #{tag} overview
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
