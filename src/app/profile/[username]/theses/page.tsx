import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  economics:    { label: 'Economics',   color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  politics:     { label: 'Politics',    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  technology:   { label: 'Technology',  color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  science:      { label: 'Science',     color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  ethics:       { label: 'Ethics',      color: 'text-surface-300', bg: 'bg-surface-200/50', border: 'border-surface-400/30' },
  philosophy:   { label: 'Philosophy',  color: 'text-surface-300', bg: 'bg-surface-200/50', border: 'border-surface-400/30' },
  culture:      { label: 'Culture',     color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  health:       { label: 'Health',      color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  environment:  { label: 'Environment', color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  education:    { label: 'Education',   color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof CircleDot }> = {
  active:     { label: 'Active',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     Icon: CircleDot },
  vindicated: { label: 'Vindicated', color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     Icon: CheckCircle2 },
  refuted:    { label: 'Refuted',    color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', Icon: XCircle },
  expired:    { label: 'Expired',    color: 'text-surface-500', bg: 'bg-surface-200/40', border: 'border-surface-400/30', Icon: Clock },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Civic Theses · Lobby Market' }

  const name = profile.display_name ?? `@${profile.username}`
  const canonicalUrl = `${BASE_URL}/profile/${profile.username}/theses`

  return {
    title: `${name}'s Civic Theses · Lobby Market`,
    description: `${name}'s civic predictions on Lobby Market — beliefs staked openly, tracked for accuracy over time.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${name}'s Civic Theses`,
      description: `Civic predictions and belief statements staked publicly by ${name}.`,
      url: canonicalUrl,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Civic Theses · Lobby Market`,
      description: `${name} stakes civic predictions openly. See their accuracy record.`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileThesesPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const { data: { session } } = await supabase.auth.getSession()
  const isOwn = session?.user?.id === profile.id

  const query = supabase
    .from('civic_theses')
    .select('id, statement, rationale, category, resolution_date, status, agree_count, disagree_count, created_at, resolved_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (!isOwn) query.eq('is_public', true)

  const { data: theses } = await query

  const list = theses ?? []
  const total = list.length
  const active = list.filter(t => t.status === 'active').length
  const vindicated = list.filter(t => t.status === 'vindicated').length
  const refuted = list.filter(t => t.status === 'refuted').length
  const resolved = vindicated + refuted
  const accuracy = resolved > 0 ? Math.round((vindicated / resolved) * 100) : null

  const displayName = profile.display_name ?? `@${profile.username}`

  return (
    <div className="min-h-screen bg-surface-50 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28 space-y-6">

        {/* Back */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {displayName}
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size={48}
          />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              {displayName}
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Civic Theses · Belief Ledger
            </p>
          </div>
        </div>

        {/* Stats row */}
        {total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',      value: total,         color: 'text-white' },
              { label: 'Active',     value: active,        color: 'text-for-400' },
              { label: 'Vindicated', value: vindicated,    color: 'text-emerald' },
              { label: 'Accuracy',   value: accuracy !== null ? `${accuracy}%` : '—', color: accuracy !== null && accuracy >= 60 ? 'text-emerald' : accuracy !== null && accuracy < 40 ? 'text-against-400' : 'text-gold' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
                <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Thesis list */}
        {list.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No civic theses yet"
            description={
              isOwn
                ? 'You have not staked any civic predictions yet. Go to /thesis to write your first one.'
                : `${displayName} has not published any civic theses yet.`
            }
            action={isOwn ? { label: 'Write a thesis', href: '/thesis' } : undefined}
          />
        ) : (
          <ul className="space-y-4">
            {list.map((thesis) => {
              const catConf = CATEGORY_CONFIG[thesis.category] ?? CATEGORY_CONFIG.politics
              const statusConf = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
              const StatusIcon = statusConf.Icon
              const total = (thesis.agree_count ?? 0) + (thesis.disagree_count ?? 0)
              const agreePct = total > 0 ? Math.round(((thesis.agree_count ?? 0) / total) * 100) : 50

              return (
                <li key={thesis.id}>
                  <Link
                    href={`/thesis/${thesis.id}`}
                    className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-all p-5 group"
                  >
                    {/* Top row: category + status + chevron */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border',
                        catConf.color, catConf.bg, catConf.border,
                      )}>
                        {catConf.label}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border',
                        statusConf.color, statusConf.bg, statusConf.border,
                      )}>
                        <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
                        {statusConf.label}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-600 ml-auto group-hover:text-white transition-colors" aria-hidden="true" />
                    </div>

                    {/* Statement */}
                    <p className="text-sm font-medium text-white leading-snug mb-3">
                      &ldquo;{thesis.statement}&rdquo;
                    </p>

                    {/* Agree / disagree bar */}
                    {total > 0 && (
                      <div className="mb-3">
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                          <div
                            className="bg-emerald h-full transition-all"
                            style={{ width: `${agreePct}%` }}
                          />
                          <div
                            className="bg-against-500 h-full flex-1"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald">
                            <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                            {thesis.agree_count ?? 0} agree
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-against-400">
                            {thesis.disagree_count ?? 0} disagree
                            <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Footer: date info */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {relativeTime(thesis.created_at)}
                      </span>
                      {thesis.resolution_date && thesis.status === 'active' && (
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Gavel className="h-3 w-3" aria-hidden="true" />
                          Resolves {formatDate(thesis.resolution_date)}
                        </span>
                      )}
                      {thesis.resolved_at && thesis.status !== 'active' && (
                        <span className="inline-flex items-center gap-1">
                          <Scale className="h-3 w-3" aria-hidden="true" />
                          Resolved {relativeTime(thesis.resolved_at)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer CTA */}
        {isOwn && (
          <div className="rounded-2xl border border-dashed border-surface-400 p-5 text-center">
            <p className="text-xs font-mono text-surface-500 mb-3">
              Stake your next civic prediction
            </p>
            <Link
              href="/thesis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-bold transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Write a thesis
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
