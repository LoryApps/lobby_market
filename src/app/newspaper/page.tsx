import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Topic, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 1800

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'The Lobby Dispatch · Lobby Market',
  description:
    'Your daily civic front page — top debates, laws passed, voices heard, and the numbers that move the Lobby.',
  openGraph: {
    title: 'The Lobby Dispatch · Lobby Market',
    description: 'Today\'s top debates, recent laws, and hot takes — the civic front page.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Lobby Dispatch · Lobby Market',
    description: 'Today\'s top debates, recent laws, and hot takes — the civic front page.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEdition(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const day = Math.floor(diff / (1000 * 60 * 60 * 24))
  return `Vol. ${now.getFullYear()} · No. ${day}`
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function VoteBar({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'md' }) {
  const h = size === 'md' ? 'h-2' : 'h-1.5'
  return (
    <div className={cn('flex items-center gap-2 w-full')}>
      <span className="text-[10px] font-mono text-for-400 w-7 text-right shrink-0">{Math.round(pct)}%</span>
      <div className={cn('flex-1 rounded-full bg-surface-300 overflow-hidden', h)}>
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 shrink-0">{100 - Math.round(pct)}%</span>
    </div>
  )
}

function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="border-surface-300 my-4" />
  return (
    <div className="flex items-center gap-3 my-4">
      <hr className="flex-1 border-surface-300" />
      <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-surface-500 uppercase">{label}</span>
      <hr className="flex-1 border-surface-300" />
    </div>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HotTake {
  id: string
  side: string
  reason: string
  created_at: string
  voter_username: string
  voter_display_name: string | null
  voter_avatar_url: string | null
  voter_role: string
  topic_statement: string
  topic_id: string
  topic_category: string | null
}

interface RecentArgument {
  id: string
  side: string
  content: string
  upvotes: number
  created_at: string
  topic_statement: string
  topic_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

interface DispatchData {
  leadStory: Topic | null
  leadAuthor: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'role'> | null
  recentLaws: Array<{
    id: string
    statement: string
    category: string | null
    total_votes: number
    blue_pct: number
    established_at: string | null
  }>
  hotTakes: HotTake[]
  featuredArgument: RecentArgument | null
  platformStats: {
    totalVotes: number
    activeTopics: number
    lawsThisMonth: number
    totalDebaters: number
  }
  risingTopic: Topic | null
  contested: Topic | null
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDispatchData(): Promise<DispatchData> {
  const supabase = await createClient()

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    topicsRes,
    lawsRes,
    votesRes,
    debatorsRes,
    lawsMonthRes,
    hotTakesRes,
    argumentsRes,
  ] = await Promise.all([
    // Top active topics ordered by feed_score
    supabase
      .from('topics')
      .select('*')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(10),

    // Recent laws (last 30 days or most recent 5)
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, created_at')
      .eq('status', 'law')
      .order('created_at', { ascending: false })
      .limit(5),

    // Total votes (platform stat)
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true }),

    // Total debaters
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),

    // Laws this month
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'law')
      .gte('created_at', monthAgo),

    // Hot takes (votes with reasons) — join manually
    supabase
      .from('votes')
      .select('id, side, reason, created_at, user_id, topic_id')
      .not('reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20),

    // Top arguments by upvotes
    supabase
      .from('topic_arguments')
      .select('id, side, content, upvotes, created_at, topic_id, user_id')
      .order('upvotes', { ascending: false })
      .gte('created_at', dayAgo)
      .limit(10),
  ])

  const allTopics = (topicsRes.data ?? []) as Topic[]
  const leadStory = allTopics[0] ?? null
  const risingTopic = allTopics[1] ?? null

  // Find the most contested (closest to 50/50)
  const contested =
    allTopics
      .filter((t) => t.total_votes >= 5)
      .sort((a, b) => Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50))[0] ??
    null

  // Fetch author of lead story
  let leadAuthor: DispatchData['leadAuthor'] = null
  if (leadStory?.author_id) {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', leadStory.author_id)
      .maybeSingle()
    leadAuthor = data
  }

  // Enrich hot takes
  const rawTakes = hotTakesRes.data ?? []
  const takeUserIds = Array.from(new Set(rawTakes.map((t) => t.user_id)))
  const takeTopicIds = Array.from(new Set(rawTakes.map((t) => t.topic_id)))

  const [takeUsersRes, takeTopicsRes] = await Promise.all([
    takeUserIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', takeUserIds)
      : Promise.resolve({ data: [] }),
    takeTopicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', takeTopicIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap = new Map(
    (takeUsersRes.data ?? []).map((u: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [u.id, u])
  )
  const topicMap = new Map(
    (takeTopicsRes.data ?? []).map((t: { id: string; statement: string; category: string | null }) => [t.id, t])
  )

  const hotTakes: HotTake[] = rawTakes
    .map((t) => {
      const user = userMap.get(t.user_id)
      const topic = topicMap.get(t.topic_id)
      if (!user || !topic || !t.reason) return null
      return {
        id: t.id,
        side: t.side,
        reason: t.reason as string,
        created_at: t.created_at,
        voter_username: user.username,
        voter_display_name: user.display_name,
        voter_avatar_url: user.avatar_url,
        voter_role: user.role,
        topic_statement: topic.statement,
        topic_id: topic.id,
        topic_category: topic.category,
      }
    })
    .filter(Boolean) as HotTake[]

  // Enrich top argument
  let featuredArgument: RecentArgument | null = null
  const rawArgs = argumentsRes.data ?? []
  if (rawArgs.length > 0) {
    const topArg = rawArgs[0]
    const [argUserRes, argTopicRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role')
        .eq('id', topArg.user_id)
        .maybeSingle(),
      supabase
        .from('topics')
        .select('statement')
        .eq('id', topArg.topic_id)
        .maybeSingle(),
    ])
    if (argUserRes.data && argTopicRes.data) {
      featuredArgument = {
        id: topArg.id,
        side: topArg.side,
        content: topArg.content,
        upvotes: topArg.upvotes ?? 0,
        created_at: topArg.created_at,
        topic_statement: (argTopicRes.data as { statement: string }).statement,
        topic_id: topArg.topic_id,
        author_username: (argUserRes.data as { username: string }).username,
        author_display_name: (argUserRes.data as { display_name: string | null }).display_name,
        author_avatar_url: (argUserRes.data as { avatar_url: string | null }).avatar_url,
        author_role: (argUserRes.data as { role: string }).role,
      }
    }
  }

  // Recent laws with established_at derived from created_at
  const recentLaws = (lawsRes.data ?? []).map((t: { id: string; statement: string; category: string | null; total_votes: number; blue_pct: number; created_at: string }) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    total_votes: t.total_votes ?? 0,
    blue_pct: t.blue_pct ?? 50,
    established_at: t.created_at,
  }))

  return {
    leadStory,
    leadAuthor,
    recentLaws,
    hotTakes: hotTakes.slice(0, 4),
    featuredArgument,
    platformStats: {
      totalVotes: votesRes.count ?? 0,
      activeTopics: allTopics.length,
      lawsThisMonth: lawsMonthRes.count ?? 0,
      totalDebaters: debatorsRes.count ?? 0,
    },
    risingTopic,
    contested,
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function NewspaperPage() {
  const data = await fetchDispatchData()

  const {
    leadStory,
    leadAuthor,
    recentLaws,
    hotTakes,
    featuredArgument,
    platformStats,
    risingTopic,
    contested,
  } = data

  const edition = formatEdition()
  const dateStr = formatDate()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* ── Masthead ──────────────────────────────────────────────────────── */}
        <header className="text-center border-b-2 border-white pb-4 mb-1">
          <p className="text-[10px] font-mono text-surface-500 tracking-[0.25em] uppercase mb-1">
            {edition}
          </p>
          <h1 className="font-mono text-4xl md:text-6xl font-black tracking-tight text-white leading-none">
            THE LOBBY DISPATCH
          </h1>
          <p className="text-xs font-mono text-surface-400 tracking-widest mt-1">
            YOUR CIVIC INTELLIGENCE · DAILY
          </p>
        </header>

        {/* ── Date strip ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between py-1.5 border-b border-surface-300 mb-4">
          <span className="text-[10px] font-mono text-surface-500">{dateStr}</span>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-surface-500">
              <span className="text-for-400 font-bold">{platformStats.activeTopics}</span> active debates
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              <span className="text-gold font-bold">{platformStats.lawsThisMonth}</span> laws this month
            </span>
            <span className="text-[10px] font-mono text-surface-500 hidden sm:block">
              <span className="text-emerald font-bold">{platformStats.totalDebaters.toLocaleString()}</span> citizens
            </span>
          </div>
        </div>

        {/* ── Main grid ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x lg:divide-surface-300">

          {/* ── Left column: Lead story + contested ───────────────────────── */}
          <div className="lg:col-span-2 lg:pr-6">

            {/* Lead story */}
            {leadStory ? (
              <article>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-against-400 uppercase bg-against-950 border border-against-800 px-2 py-0.5 rounded">
                    LEAD DEBATE
                  </span>
                  {leadStory.category && (
                    <span className={cn('text-[9px] font-mono font-semibold tracking-widest uppercase', CAT_COLOR[leadStory.category] ?? 'text-surface-500')}>
                      {leadStory.category}
                    </span>
                  )}
                </div>

                <Link href={`/topic/${leadStory.id}`} className="group block">
                  <h2 className="font-mono text-2xl md:text-3xl font-bold text-white leading-snug group-hover:text-for-300 transition-colors mb-3">
                    {leadStory.statement}
                  </h2>
                </Link>

                {/* Byline */}
                {leadAuthor && (
                  <p className="text-[10px] font-mono text-surface-500 mb-3">
                    Proposed by{' '}
                    <Link href={`/profile/${leadAuthor.username}`} className="text-surface-400 hover:text-white transition-colors">
                      @{leadAuthor.username}
                    </Link>
                  </p>
                )}

                {/* Vote stats */}
                <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-xl font-mono font-black text-for-400">
                        {Math.round(leadStory.blue_pct ?? 50)}%
                      </p>
                      <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wider">For</p>
                    </div>
                    <div className="text-center border-x border-surface-300">
                      <p className="text-xl font-mono font-black text-white">
                        {(leadStory.total_votes ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wider">Votes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-mono font-black text-against-400">
                        {100 - Math.round(leadStory.blue_pct ?? 50)}%
                      </p>
                      <p className="text-[9px] font-mono text-surface-500 uppercase tracking-wider">Against</p>
                    </div>
                  </div>
                  <VoteBar pct={leadStory.blue_pct ?? 50} size="md" />
                </div>

                <Link
                  href={`/topic/${leadStory.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Read full debate <ArrowRight className="h-3 w-3" />
                </Link>
              </article>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-mono text-surface-500">No active debates at this moment.</p>
              </div>
            )}

            <Divider label="Also in the Lobby" />

            {/* Rising + Contested side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {risingTopic && (
                <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="h-3 w-3 text-emerald" aria-hidden="true" />
                    <span className="text-[9px] font-mono font-bold tracking-widest text-emerald uppercase">Rising</span>
                  </div>
                  <Link href={`/topic/${risingTopic.id}`} className="group block">
                    <p className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-2 line-clamp-3">
                      {risingTopic.statement}
                    </p>
                  </Link>
                  <VoteBar pct={risingTopic.blue_pct ?? 50} />
                  <p className="text-[10px] font-mono text-surface-500 mt-1.5">
                    {(risingTopic.total_votes ?? 0).toLocaleString()} votes
                  </p>
                </div>
              )}
              {contested && contested.id !== leadStory?.id && (
                <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Scale className="h-3 w-3 text-purple" aria-hidden="true" />
                    <span className="text-[9px] font-mono font-bold tracking-widest text-purple uppercase">Contested</span>
                  </div>
                  <Link href={`/topic/${contested.id}`} className="group block">
                    <p className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-2 line-clamp-3">
                      {contested.statement}
                    </p>
                  </Link>
                  <VoteBar pct={contested.blue_pct ?? 50} />
                  <p className="text-[10px] font-mono text-surface-500 mt-1.5">
                    Split: {Math.round(Math.abs((contested.blue_pct ?? 50) - 50))}pt from center
                  </p>
                </div>
              )}
            </div>

            {/* Featured argument */}
            {featuredArgument && (
              <>
                <Divider label="Argument of the Hour" />
                <div className="border-l-2 border-for-500 pl-4 mb-4">
                  <div className="flex items-start gap-3 mb-2">
                    <Avatar
                      src={featuredArgument.author_avatar_url}
                      fallback={featuredArgument.author_display_name ?? featuredArgument.author_username}
                      size="sm"
                    />
                    <div>
                      <Link href={`/profile/${featuredArgument.author_username}`} className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors">
                        {featuredArgument.author_display_name ?? `@${featuredArgument.author_username}`}
                      </Link>
                      <p className="text-[10px] font-mono text-surface-500">
                        arguing{' '}
                        <span className={featuredArgument.side === 'blue' ? 'text-for-400' : 'text-against-400'}>
                          {featuredArgument.side === 'blue' ? 'FOR' : 'AGAINST'}
                        </span>
                        {' '}·{' '}
                        <Link href={`/topic/${featuredArgument.topic_id}`} className="hover:text-surface-300 transition-colors">
                          {featuredArgument.topic_statement.slice(0, 50)}
                          {featuredArgument.topic_statement.length > 50 ? '…' : ''}
                        </Link>
                      </p>
                    </div>
                  </div>
                  <blockquote className="text-sm font-mono text-surface-200 leading-relaxed italic mb-2">
                    &ldquo;{featuredArgument.content.slice(0, 280)}{featuredArgument.content.length > 280 ? '…' : ''}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                      {featuredArgument.side === 'blue'
                        ? <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden="true" />
                        : <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />}
                      {featuredArgument.upvotes} agreement votes
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Right column: Laws + Hot Takes + Stats ─────────────────────── */}
          <div className="lg:pl-6 border-t border-surface-300 pt-6 lg:border-t-0 lg:pt-0">

            {/* Laws section */}
            {recentLaws.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] text-gold uppercase">
                    Laws of the Lobby
                  </h2>
                </div>
                <div className="space-y-3">
                  {recentLaws.map((law, i) => (
                    <div key={law.id} className="group">
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] font-mono text-surface-600 mt-0.5 w-4 shrink-0">{ordinal(i + 1)}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/topic/${law.id}`} className="group block">
                            <p className="text-xs font-mono font-semibold text-surface-200 group-hover:text-white transition-colors leading-snug line-clamp-2">
                              {law.statement}
                            </p>
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            {law.category && (
                              <span className={cn('text-[9px] font-mono', CAT_COLOR[law.category] ?? 'text-surface-500')}>
                                {law.category}
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-surface-600">
                              {(law.total_votes ?? 0).toLocaleString()} votes · {Math.round(law.blue_pct ?? 50)}% for
                            </span>
                          </div>
                        </div>
                      </div>
                      {i < recentLaws.length - 1 && <hr className="border-surface-300 mt-3" />}
                    </div>
                  ))}
                </div>
                <Link
                  href="/law"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-gold hover:text-amber-300 transition-colors mt-3"
                >
                  Full law codex <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </section>
            )}

            <Divider />

            {/* Hot takes */}
            {hotTakes.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                  <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] text-against-400 uppercase">
                    Voices from the Floor
                  </h2>
                </div>
                <div className="space-y-4">
                  {hotTakes.map((take) => (
                    <div key={take.id} className="border-l border-surface-400 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar
                          src={take.voter_avatar_url}
                          fallback={take.voter_display_name ?? take.voter_username}
                          size="xs"
                        />
                        <Link href={`/profile/${take.voter_username}`} className="text-[10px] font-mono font-semibold text-surface-400 hover:text-white transition-colors">
                          @{take.voter_username}
                        </Link>
                        <span
                          className={cn(
                            'text-[8px] font-mono font-bold px-1 rounded',
                            take.side === 'blue'
                              ? 'text-for-400 bg-for-950'
                              : 'text-against-400 bg-against-950',
                          )}
                        >
                          {take.side === 'blue' ? 'FOR' : 'AGAINST'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-surface-300 italic leading-snug mb-1">
                        &ldquo;{take.reason}&rdquo;
                      </p>
                      <Link href={`/topic/${take.topic_id}`} className="text-[9px] font-mono text-surface-600 hover:text-surface-400 transition-colors line-clamp-1">
                        re: {take.topic_statement}
                      </Link>
                    </div>
                  ))}
                </div>
                <Link
                  href="/hot-takes"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-against-400 hover:text-against-300 transition-colors mt-3"
                >
                  More voices <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </section>
            )}

            <Divider />

            {/* Platform stats */}
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] text-purple uppercase">
                  The Numbers
                </h2>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Total votes cast', value: platformStats.totalVotes.toLocaleString(), color: 'text-for-400' },
                  { label: 'Active debates', value: platformStats.activeTopics.toString(), color: 'text-emerald' },
                  { label: 'Laws this month', value: platformStats.lawsThisMonth.toString(), color: 'text-gold' },
                  { label: 'Citizens registered', value: platformStats.totalDebaters.toLocaleString(), color: 'text-purple' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-surface-500">{label}</span>
                    <span className={cn('text-xs font-mono font-bold tabular-nums', color)}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <Divider />

            {/* Quick links */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                <h2 className="text-[10px] font-mono font-bold tracking-[0.2em] text-surface-500 uppercase">
                  Explore the Lobby
                </h2>
              </div>
              <div className="space-y-1.5">
                {[
                  { href: '/trending', label: 'Trending topics' },
                  { href: '/floor', label: 'The Floor — live chamber' },
                  { href: '/debate', label: 'Scheduled debates' },
                  { href: '/law/graph', label: 'Law graph' },
                  { href: '/leaderboard', label: 'Leaderboard' },
                  { href: '/search', label: 'Search the Lobby' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between py-1 text-[11px] font-mono text-surface-400 hover:text-white transition-colors border-b border-surface-300 last:border-0"
                  >
                    {label}
                    <ArrowRight className="h-2.5 w-2.5 opacity-50" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ── Footer strip ──────────────────────────────────────────────────── */}
        <footer className="border-t-2 border-white mt-8 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] font-mono text-surface-600 tracking-widest uppercase">
              The Lobby Dispatch · Published daily · lobby.market
            </p>
            <div className="flex items-center gap-4">
              <Link href="/api/rss" className="text-[9px] font-mono text-surface-600 hover:text-surface-400 transition-colors tracking-widest uppercase">
                RSS
              </Link>
              <Link href="/about" className="text-[9px] font-mono text-surface-600 hover:text-surface-400 transition-colors tracking-widest uppercase">
                About
              </Link>
              <Link href="/topic/create" className="text-[9px] font-mono text-for-500 hover:text-for-400 transition-colors tracking-widest uppercase">
                Submit a Topic
              </Link>
            </div>
          </div>
        </footer>
      </main>
      <BottomNav />
    </div>
  )
}
