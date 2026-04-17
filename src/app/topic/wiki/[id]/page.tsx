import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  FileEdit,
  Gavel,
  History,
  Scale,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopicWikiRenderer } from '@/components/topic/TopicWikiRenderer'
import { TopicBacklinks } from '@/components/topic/TopicBacklinks'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface WikiPageProps {
  params: { id: string }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: WikiPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, description, category, status')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Wiki · Lobby Market' }

  const snippet = topic.description
    ? topic.description.replace(/[#*`>\[\]]/g, '').slice(0, 160).trim()
    : `Community wiki article for: ${topic.statement}`

  const title = `${topic.statement} — Wiki · Lobby Market`

  return {
    title,
    description: snippet,
    openGraph: {
      title,
      description: snippet,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description: snippet,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TopicWikiPage({ params }: WikiPageProps) {
  const supabase = await createClient()

  // Fetch topic and last editor in parallel
  const { data: topicRaw } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!topicRaw) notFound()

  const topic = topicRaw as Topic

  // Fetch last editor profile if available
  let editorProfile: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null = null
  if (topic.description_updated_by) {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', topic.description_updated_by)
      .maybeSingle()
    editorProfile = data
  }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600 mb-5">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href={`/topic/${topic.id}`} className="hover:text-white transition-colors truncate max-w-[200px]">
            {topic.statement.length > 40 ? topic.statement.slice(0, 40) + '…' : topic.statement}
          </Link>
          <span>/</span>
          <span className="text-surface-400">Wiki</span>
        </nav>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* Back link */}
          <Link
            href={`/topic/${topic.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          {/* Title + badges */}
          <div className="flex items-start gap-3 flex-wrap mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0 mt-0.5">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-mono text-xl md:text-2xl font-bold text-white leading-tight mb-2">
                {topic.statement}
              </h1>
              <div className="flex items-center flex-wrap gap-2">
                {topic.category && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-300/60 text-surface-500 border border-surface-300">
                    {topic.category}
                  </span>
                )}
                <Badge variant={statusBadge}>
                  <StatusIcon className="h-3 w-3 mr-1" aria-hidden />
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>
                <span className="text-[11px] font-mono text-surface-600">
                  {topic.total_votes.toLocaleString()} votes
                </span>
              </div>
            </div>
          </div>

          {/* Vote bar */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 mt-4">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
              <span className="text-for-400 font-semibold">{forPct}% FOR</span>
              <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
                aria-label={`${forPct}% voted for`}
              />
              <div
                className="h-full bg-against-600 transition-all duration-500"
                style={{ width: `${againstPct}%` }}
                aria-label={`${againstPct}% voted against`}
              />
            </div>
          </div>
        </div>

        {/* ── Actions row ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6 pb-4 border-b border-surface-300">
          {/* Last editor */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-surface-600 min-w-0">
            {editorProfile ? (
              <>
                <Clock className="h-3 w-3 flex-shrink-0" aria-hidden />
                <span>Edited by</span>
                <Link
                  href={`/profile/${editorProfile.username}`}
                  className="flex items-center gap-1.5 hover:text-white transition-colors min-w-0"
                >
                  <Avatar
                    src={editorProfile.avatar_url}
                    fallback={editorProfile.display_name || editorProfile.username}
                    size="xs"
                  />
                  <span className="truncate">
                    {editorProfile.display_name || `@${editorProfile.username}`}
                  </span>
                </Link>
                {topic.description_updated_at && (
                  <span className="text-surface-700 flex-shrink-0">
                    · {relativeTime(topic.description_updated_at)}
                  </span>
                )}
              </>
            ) : topic.description_updated_at ? (
              <>
                <Clock className="h-3 w-3 flex-shrink-0" aria-hidden />
                <span>Last edited {relativeTime(topic.description_updated_at)}</span>
              </>
            ) : (
              <>
                <FileEdit className="h-3 w-3 flex-shrink-0" aria-hidden />
                <span className="italic">No edits yet</span>
              </>
            )}
          </div>

          {/* History + Edit */}
          <div className="flex items-center gap-2">
            <Link
              href={`/topic/wiki/${topic.id}/history`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'text-xs font-mono text-surface-500 border border-surface-300',
                'bg-surface-200 hover:bg-surface-300 hover:text-white transition-colors'
              )}
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              History
            </Link>
            <Link
              href={`/topic/${topic.id}#wiki`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'text-xs font-mono text-white border border-for-500/40',
                'bg-for-600/80 hover:bg-for-500 transition-colors'
              )}
            >
              <FileEdit className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Link>
          </div>
        </div>

        {/* ── Wiki content ─────────────────────────────────────────────────── */}
        <section aria-label="Wiki content" className="mb-10">
          <TopicWikiRenderer description={topic.description} />
        </section>

        {/* ── Backlinks ────────────────────────────────────────────────────── */}
        <section
          aria-label="Related topics"
          className="border-t border-surface-300 pt-6"
        >
          <TopicBacklinks topicId={topic.id} />
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
