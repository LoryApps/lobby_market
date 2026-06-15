import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Globe,
  Layers,
  Lock,
  Plus,
  Scale,
  Tag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:    'text-gold border-gold/30 bg-gold/8',
  Politics:     'text-for-400 border-for-500/30 bg-for-500/8',
  Technology:   'text-purple border-purple/30 bg-purple/8',
  Ethics:       'text-emerald border-emerald/30 bg-emerald/8',
  Culture:      'text-against-400 border-against-500/30 bg-against-500/8',
  Science:      'text-for-300 border-for-400/30 bg-for-400/8',
  Environment:  'text-emerald border-emerald/25 bg-emerald/6',
  Law:          'text-gold border-gold/25 bg-gold/6',
  Healthcare:   'text-against-300 border-against-400/25 bg-against-400/6',
  Education:    'text-purple border-purple/25 bg-purple/6',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Collections · Lobby Market' }

  const name = profile.display_name ?? profile.username
  const title = `${name}'s Topic Collections · Lobby Market`
  const description = `Browse curated civic topic collections by ${name} — hand-picked reading lists covering democracy, policy, and public debate.`
  const ogImageUrl = `${BASE_URL}/api/og/profile/${encodeURIComponent(profile.username)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionRow {
  id: string
  name: string
  description: string | null
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
}

interface CollectionItemRow {
  collection_id: string
  topics: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
  } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileCollectionsPage({ params }: PageProps) {
  const supabase = await createClient()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // Auth user (for self-detection and private-collection visibility)
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const isOwnProfile = authUser?.id === profile.id

  // Fetch collections — own profile sees all, others see only public
  let query = supabase
    .from('topic_collections')
    .select('id, name, description, is_public, item_count, created_at, updated_at')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!isOwnProfile) {
    query = query.eq('is_public', true)
  }

  const { data: collections } = await query as { data: CollectionRow[] | null }
  const rows = collections ?? []

  // Fetch a preview of topics for each collection (up to 4 per collection)
  const collectionIds = rows.map((c) => c.id)
  const previewMap: Record<string, CollectionItemRow['topics'][]> = {}

  if (collectionIds.length > 0) {
    const { data: items } = await supabase
      .from('collection_items')
      .select('collection_id, topics(id, statement, category, status, blue_pct)')
      .in('collection_id', collectionIds)
      .order('added_at', { ascending: false })
      .limit(collectionIds.length * 4) as { data: CollectionItemRow[] | null }

    if (items) {
      for (const item of items) {
        if (!previewMap[item.collection_id]) previewMap[item.collection_id] = []
        if (previewMap[item.collection_id].length < 4 && item.topics) {
          previewMap[item.collection_id].push(item.topics)
        }
      }
    }
  }

  const displayName = profile.display_name ?? profile.username
  const publicCount = rows.filter((c) => c.is_public).length
  const privateCount = rows.filter((c) => !c.is_public).length
  const totalTopics = rows.reduce((s, c) => s + c.item_count, 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href={`/profile/${profile.username}`}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <Avatar
                src={profile.avatar_url ?? undefined}
                fallback={displayName}
                size="sm"
              />
              <div className="min-w-0">
                <h1 className="font-mono text-xl font-bold text-white truncate">
                  {displayName}&rsquo;s Collections
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  Curated civic reading lists
                </p>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <Link
              href="/collections"
              className="mt-1 flex items-center gap-1.5 rounded-xl bg-for-600/20 border border-for-500/30 text-for-400 text-xs font-mono font-semibold px-3 py-2 hover:bg-for-600/30 transition-colors flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manage</span>
            </Link>
          )}
        </div>

        {/* Stats summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Collections', value: rows.length, icon: Layers, color: 'text-for-400' },
              { label: 'Public', value: publicCount, icon: Globe, color: 'text-emerald' },
              { label: 'Topics Curated', value: totalTopics, icon: BookOpen, color: 'text-gold' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-300 bg-surface-100 p-3"
              >
                <s.icon className={cn('h-4 w-4 mb-1', s.color)} />
                <p className="text-lg font-mono font-bold text-white">{s.value}</p>
                <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {rows.length === 0 && (
          <EmptyState
            icon={Layers}
            iconColor="text-for-400"
            title={
              isOwnProfile
                ? 'No collections yet'
                : `${displayName} hasn't created any public collections`
            }
            description={
              isOwnProfile
                ? 'Organise your favourite debates into reading lists. Create collections by topic, theme, or anything you like.'
                : 'Collections let citizens curate civic debates into shareable reading lists.'
            }
            actions={
              isOwnProfile
                ? [{ label: 'Create a Collection', href: '/collections', variant: 'primary' as const }]
                : []
            }
          />
        )}

        {/* Collections list */}
        {rows.length > 0 && (
          <div className="space-y-4">
            {/* Private banner for own profile */}
            {isOwnProfile && privateCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100 border border-surface-300">
                <Lock className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                <p className="text-xs font-mono text-surface-500">
                  {privateCount} private {privateCount === 1 ? 'collection is' : 'collections are'} only visible to you.
                </p>
              </div>
            )}

            {rows.map((collection) => {
              const preview = previewMap[collection.id] ?? []
              const categories = Array.from(
                new Set(preview.map((t) => t?.category).filter(Boolean))
              ) as string[]

              return (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  className={cn(
                    'block p-5 rounded-2xl border transition-all group',
                    'bg-surface-100 border-surface-300 hover:border-surface-400',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      'mt-0.5 flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center',
                      collection.is_public
                        ? 'bg-for-500/10 border border-for-500/20'
                        : 'bg-surface-200 border border-surface-300',
                    )}>
                      {collection.is_public
                        ? <Globe className="h-4 w-4 text-for-400" />
                        : <Lock className="h-4 w-4 text-surface-500" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-mono font-semibold text-white group-hover:text-for-400 transition-colors leading-snug">
                          {collection.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] font-mono text-surface-500">
                            {collection.item_count} {collection.item_count === 1 ? 'topic' : 'topics'}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
                        </div>
                      </div>

                      {collection.description && (
                        <p className="text-xs font-mono text-surface-500 mt-1 line-clamp-2 leading-relaxed">
                          {collection.description}
                        </p>
                      )}

                      {/* Category tags from preview */}
                      {categories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-mono font-medium border rounded-full px-2 py-0.5',
                                CATEGORY_COLORS[cat] ?? 'text-surface-400 border-surface-500/30 bg-surface-300/20',
                              )}
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Topic previews */}
                      {preview.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {preview.slice(0, 3).map((topic) => (
                            topic && (
                              <div
                                key={topic.id}
                                className="flex items-start gap-2 text-[11px] font-mono text-surface-500"
                              >
                                <Scale className="h-3 w-3 flex-shrink-0 mt-0.5 text-surface-600" />
                                <span className="line-clamp-1">{topic.statement}</span>
                              </div>
                            )
                          ))}
                          {collection.item_count > 3 && (
                            <p className="text-[10px] font-mono text-surface-600 pl-5">
                              +{collection.item_count - 3} more
                            </p>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-3 mt-3">
                        <span
                          className={cn(
                            'text-[10px] font-mono font-semibold',
                            collection.is_public ? 'text-emerald' : 'text-surface-500',
                          )}
                        >
                          {collection.is_public ? 'Public' : 'Private'}
                        </span>
                        <span className="text-[10px] font-mono text-surface-600">·</span>
                        <span className="text-[10px] font-mono text-surface-500">
                          Updated {relativeTime(collection.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* CTA for own profile */}
        {isOwnProfile && rows.length > 0 && (
          <div className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 text-center space-y-2">
            <Layers className="h-7 w-7 text-for-400 mx-auto" />
            <p className="text-sm font-mono font-semibold text-white">
              Organise your civic knowledge
            </p>
            <p className="text-xs font-mono text-surface-500">
              Create new collections and share them publicly to help others explore important debates.
            </p>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 rounded-xl bg-for-600/20 border border-for-500/30 text-for-400 text-xs font-mono font-semibold px-4 py-2 hover:bg-for-600/30 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Manage Collections
            </Link>
          </div>
        )}

        {/* CTA for visitors */}
        {!isOwnProfile && rows.length > 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 text-center space-y-2">
            <p className="text-xs font-mono text-surface-500">
              Want to save topics you care about?
            </p>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-semibold px-4 py-2 hover:bg-surface-300 transition-colors"
            >
              <Layers className="h-3.5 w-3.5" />
              Create your own collection
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
