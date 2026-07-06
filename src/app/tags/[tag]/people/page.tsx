import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  TrendingUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { PeopleFollowButton } from './PeopleFollowButton'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `People following #${tag} · Lobby Market`,
    description: `Meet the community debating "${tag}" on Lobby Market — browse followers, their activity, and connect with fellow citizens.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_COLOR: Record<string, string> = {
  person: 'text-surface-500',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

type SortMode = 'top' | 'clout' | 'new'

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagPeoplePage({ params, searchParams }: PageProps) {
  const tag  = decodeURIComponent(params.tag).toLowerCase()
  const sort = (searchParams?.sort ?? 'top') as SortMode

  const supabase = await createClient()

  // Verify the tag has topics
  const { count: topicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!topicCount || topicCount === 0) notFound()

  // Get current user (for follow state)
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id ?? null

  // Fetch followers with their profiles
  const { data: followers } = await supabase
    .from('user_tag_follows')
    .select(`
      user_id,
      created_at,
      profiles!inner (
        id,
        username,
        display_name,
        avatar_url,
        role,
        clout,
        reputation_score,
        total_votes,
        total_arguments,
        bio,
        vote_streak
      )
    `)
    .eq('tag', tag)
    .neq('user_id', currentUserId ?? '00000000-0000-0000-0000-000000000000')
    .limit(100)

  // Sort followers
  type FollowerRow = {
    user_id: string
    created_at: string
    profiles: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      reputation_score: number
      total_votes: number
      total_arguments: number
      bio: string | null
      vote_streak: number
    }
  }

  const rows = (followers ?? []) as FollowerRow[]

  const sorted = [...rows].sort((a, b) => {
    if (sort === 'clout') return b.profiles.clout - a.profiles.clout
    if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    // 'top': by clout + total_votes + total_arguments combined score
    const scoreA = a.profiles.clout + a.profiles.total_votes * 0.5 + a.profiles.total_arguments * 2
    const scoreB = b.profiles.clout + b.profiles.total_votes * 0.5 + b.profiles.total_arguments * 2
    return scoreB - scoreA
  })

  // Check which users the current user follows
  let followingSet = new Set<string>()
  if (currentUserId) {
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .in('following_id', sorted.map(r => r.user_id))
    followingSet = new Set((follows ?? []).map((f: { following_id: string }) => f.following_id))
  }

  // Total follower count (including current user)
  const { count: totalFollowers } = await supabase
    .from('user_tag_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('tag', tag)

  const SORT_OPTIONS: { id: SortMode; label: string }[] = [
    { id: 'top',   label: 'Most Active' },
    { id: 'clout', label: 'Most Clout' },
    { id: 'new',   label: 'Newest' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + Nav */}
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            #{tag}
          </Link>
          <span className="text-surface-700 flex-shrink-0" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white flex-shrink-0">
            <Users className="h-3.5 w-3.5" />
            Community
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Users className="h-5 w-5 text-for-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">
              #{tag} Community
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              {(totalFollowers ?? 0).toLocaleString()} {totalFollowers === 1 ? 'citizen follows' : 'citizens follow'} this tag
            </p>
          </div>
          <TagFollowButton tag={tag} className="flex-shrink-0" />
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 mb-5">
          {SORT_OPTIONS.map(({ id, label }) => (
            <Link
              key={id}
              href={`/tags/${encodeURIComponent(tag)}/people?sort=${id}`}
              className={cn(
                'px-3 h-7 rounded-lg text-xs font-mono border transition-colors',
                sort === id
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* People list */}
        {sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No followers yet"
            description={`Be the first to follow #${tag} and join this community.`}
          />
        ) : (
          <div className="space-y-2">
            {sorted.map((row, idx) => {
              const p = row.profiles
              const isFollowing = followingSet.has(row.user_id)
              const roleLabel = ROLE_LABEL[p.role] ?? p.role
              const roleColor = ROLE_COLOR[p.role] ?? 'text-surface-500'

              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl',
                    'bg-surface-100 border border-surface-300',
                    'hover:border-surface-400 transition-colors group'
                  )}
                >
                  {/* Rank */}
                  {sort === 'top' && (
                    <span className="hidden sm:flex items-center justify-center w-6 flex-shrink-0 text-xs font-mono text-surface-600">
                      {idx + 1}
                    </span>
                  )}

                  {/* Avatar + name */}
                  <Link href={`/profile/${p.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar
                      src={p.avatar_url}
                      fallback={p.display_name || p.username}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                        {p.display_name || p.username}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-surface-500">@{p.username}</span>
                        <span className={cn('text-xs font-mono', roleColor)}>{roleLabel}</span>
                        {p.vote_streak > 2 && (
                          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5">
                            🔥 {p.vote_streak}
                          </span>
                        )}
                      </div>
                      {p.bio && (
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{p.bio}</p>
                      )}
                    </div>
                  </Link>

                  {/* Stats */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-gold">
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      <span className="font-mono">{p.clout.toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] font-mono text-surface-600">
                      {p.total_votes.toLocaleString()} votes
                    </div>
                    <div className="text-[10px] font-mono text-surface-600">
                      {p.total_arguments.toLocaleString()} args
                    </div>
                  </div>

                  {/* Follow button */}
                  {currentUserId && currentUserId !== p.id && (
                    <PeopleFollowButton
                      targetId={p.id}
                      initialFollowing={isFollowing}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer info */}
        {sorted.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs font-mono text-surface-600">
            <span>Showing {sorted.length} of {(totalFollowers ?? 0).toLocaleString()} followers</span>
            <Link
              href={`/tags/${encodeURIComponent(tag)}`}
              className="text-for-400 hover:text-for-300 transition-colors"
            >
              ← Back to #{tag}
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
