import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  ExternalLink,
  Gavel,
  HandshakeIcon,
  Heart,
  Scale,
  Trophy,
  Users,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)   return 'just now'
  if (m < 60)  return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  if (d < 30)  return `${d}d ago`
  return formatDate(iso)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EndorsementEntry {
  id: string
  law_id: string
  law_statement: string
  law_category: string | null
  law_established_at: string | null
  law_blue_pct: number | null
  law_total_votes: number | null
  message: string | null
  endorsed_at: string
}

interface PageProps {
  params: { username: string }
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Endorsements · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Law Endorsements · Lobby Market`
  const description = `Laws formally endorsed by ${displayName} on Lobby Market — a civic commitment to stand behind these consensus laws.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage }],
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Law endorsement row ──────────────────────────────────────────────────────

function EndorsementRow({
  entry,
  rank,
}: {
  entry: EndorsementEntry
  rank: number
}) {
  const forPct = Math.round(entry.law_blue_pct ?? 50)
  const catColor = entry.law_category ? (CAT_COLOR[entry.law_category] ?? 'text-surface-500') : 'text-surface-500'

  return (
    <div className="p-4 hover:bg-surface-100/60 transition-colors">
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className="flex-shrink-0 text-xs font-mono text-surface-600 tabular-nums w-5 text-right mt-1">
          {rank}
        </span>

        {/* Endorsement icon */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mt-0.5">
          <Heart className="h-3.5 w-3.5 text-gold" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/law/${entry.law_id}`}
            className="group"
          >
            <p className="text-sm font-medium text-white group-hover:text-gold transition-colors leading-snug">
              {entry.law_statement}
            </p>
          </Link>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {entry.law_category && (
              <span className={cn('text-xs font-mono', catColor)}>
                {entry.law_category}
              </span>
            )}
            <span className="text-xs font-mono text-surface-600">
              {forPct}% FOR
            </span>
            {entry.law_total_votes && (
              <span className="text-xs font-mono text-surface-600">
                ·
              </span>
            )}
            {entry.law_total_votes && (
              <span className="text-xs font-mono text-surface-600">
                {entry.law_total_votes.toLocaleString()} votes
              </span>
            )}
            {entry.law_established_at && (
              <>
                <span className="text-xs font-mono text-surface-600">·</span>
                <span className="text-xs font-mono text-surface-600">
                  Established {formatDate(entry.law_established_at)}
                </span>
              </>
            )}
          </div>

          {/* Personal message */}
          {entry.message && (
            <p className="mt-2 text-xs font-mono text-surface-400 italic leading-relaxed border-l-2 border-gold/30 pl-2">
              &ldquo;{entry.message}&rdquo;
            </p>
          )}

          {/* Endorsed at */}
          <div className="mt-1.5 text-[10px] font-mono text-surface-600">
            Endorsed {relTime(entry.endorsed_at)}
          </div>
        </div>

        {/* Law link */}
        <Link
          href={`/law/${entry.law_id}`}
          className="flex-shrink-0 p-1.5 rounded-lg text-surface-600 hover:text-gold hover:bg-gold/10 transition-colors"
          aria-label="View law"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileEndorsementsPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Resolve profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // 2. Current viewer
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id

  // 3. Fetch endorsements with law details
  const { data: rawEndorsements } = await supabase
    .from('law_endorsements')
    .select(`
      id,
      law_id,
      message,
      created_at,
      laws!inner (
        id, statement, category, established_at, blue_pct, total_votes
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  type RawRow = {
    id: string
    law_id: string
    message: string | null
    created_at: string
    laws: {
      id: string
      statement: string
      category: string | null
      established_at: string | null
      blue_pct: number | null
      total_votes: number | null
    }
  }

  const endorsements: EndorsementEntry[] = ((rawEndorsements ?? []) as unknown as RawRow[]).map(
    (row) => ({
      id: row.id,
      law_id: row.law_id,
      law_statement: row.laws.statement,
      law_category: row.laws.category,
      law_established_at: row.laws.established_at,
      law_blue_pct: row.laws.blue_pct,
      law_total_votes: row.laws.total_votes,
      message: row.message,
      endorsed_at: row.created_at,
    }),
  )

  const displayName = profile.display_name ?? profile.username
  const endorsementCount = endorsements.length

  // Category breakdown
  const categoryCounts = new Map<string, number>()
  for (const e of endorsements) {
    if (e.law_category) {
      categoryCounts.set(e.law_category, (categoryCounts.get(e.law_category) ?? 0) + 1)
    }
  }
  const topCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-6">

        {/* Back + breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-mono text-surface-500">
          <Link
            href={`/profile/${profile.username}`}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            {displayName}&apos;s profile
          </Link>
          <span>·</span>
          <span className="text-surface-400">Endorsements</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size={48}
            className="flex-shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <HandshakeIcon className="h-5 w-5 text-gold" />
              {isOwner ? 'My' : `${displayName}'s`} Law Endorsements
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Formal civic commitments to established laws
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
            <Heart className="h-4 w-4 mx-auto mb-1 text-gold" />
            <div className="text-xl font-mono font-bold text-gold tabular-nums">
              {endorsementCount}
            </div>
            <div className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
              {endorsementCount === 1 ? 'Law Endorsed' : 'Laws Endorsed'}
            </div>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
            <Gavel className="h-4 w-4 mx-auto mb-1 text-for-400" />
            <div className="text-xl font-mono font-bold text-for-400 tabular-nums">
              {topCategories.length > 0 ? topCategories[0][1] : 0}
            </div>
            <div className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
              {topCategories[0]?.[0] ?? 'Top Category'}
            </div>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
            <BarChart2 className="h-4 w-4 mx-auto mb-1 text-purple" />
            <div className="text-xl font-mono font-bold text-purple tabular-nums">
              {topCategories.length}
            </div>
            <div className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
              Categories
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {topCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => {
              const color = CAT_COLOR[cat] ?? 'text-surface-500'
              return (
                <span
                  key={cat}
                  className={cn(
                    'text-xs font-mono px-2 py-1 rounded-lg bg-surface-100 border border-surface-300',
                    color,
                  )}
                >
                  {cat} · {count}
                </span>
              )
            })}
          </div>
        )}

        {/* Endorsement list */}
        {endorsements.length === 0 ? (
          <EmptyState
            icon={HandshakeIcon}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title={isOwner ? "You haven't endorsed any laws yet" : `${displayName} hasn't endorsed any laws yet`}
            description={
              isOwner
                ? 'Browse established laws and formally endorse the ones you stand behind.'
                : 'When they endorse established laws, those endorsements will appear here.'
            }
            actions={isOwner ? [{ label: 'Browse Laws', href: '/law' }] : []}
          />
        ) : (
          <section className="rounded-2xl bg-surface-100 border border-gold/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
              <Heart className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-mono font-semibold text-white">
                Endorsed Laws
              </h2>
              <Badge variant="gold" size="sm" className="ml-auto">
                {endorsementCount}
              </Badge>
            </div>
            <div className="divide-y divide-surface-300/50">
              {endorsements.map((entry, i) => (
                <EndorsementRow key={entry.id} entry={entry} rank={i + 1} />
              ))}
            </div>
          </section>
        )}

        {/* Cross-links */}
        {endorsements.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: `/profile/${profile.username}`, label: 'Full Profile', icon: Users },
              { href: `/profile/${profile.username}/laws`, label: 'Law Record', icon: Scale },
              { href: `/profile/${profile.username}/impact`, label: 'Civic Impact', icon: BarChart2 },
              { href: '/law/endorsements', label: 'Most Endorsed Laws', icon: Heart },
              { href: '/leaderboard/endorsements', label: 'Top Endorsers', icon: Trophy },
              { href: '/law', label: 'Law Codex', icon: Gavel },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
