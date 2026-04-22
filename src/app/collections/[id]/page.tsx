'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  Edit2,
  ExternalLink,
  Gavel,
  Globe,
  Layers,
  Loader2,
  Lock,
  Save,
  Scale,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CollectionDetail, CollectionTopic } from '@/app/api/collections/[id]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-surface-400',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-64 mb-1" />
      <Skeleton className="h-4 w-96 mb-4" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  isOwner,
  onRemove,
}: {
  topic: CollectionTopic
  isOwner: boolean
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState(false)
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  async function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    setRemoving(true)
    try {
      await fetch(`/api/collections/items`, { method: 'DELETE' }) // handled via parent
      onRemove(topic.id)
    } catch {
      // best-effort
    } finally {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-2xl p-4',
        'hover:border-surface-400 transition-colors group'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/topic/${topic.id}`}
            className="block mb-1 group/link"
          >
            <p className="text-sm font-mono text-white group-hover/link:text-for-300 transition-colors line-clamp-2 leading-relaxed">
              {topic.statement}
            </p>
          </Link>

          {topic.note && (
            <p className="text-xs font-mono text-gold/80 italic mb-2">
              &ldquo;{topic.note}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={STATUS_VARIANT[topic.status] ?? 'proposed'} className="text-[11px] py-0 px-1.5">
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>

            {topic.category && (
              <span className={cn('text-[11px] font-mono font-semibold', CATEGORY_COLORS[topic.category] ?? 'text-surface-500')}>
                {topic.category}
              </span>
            )}

            <span className="text-[11px] font-mono text-for-400">{forPct}% FOR</span>
            <span className="text-[11px] font-mono text-surface-600">·</span>
            <span className="text-[11px] font-mono text-against-400">{againstPct}% AGAINST</span>
            <span className="text-[11px] font-mono text-surface-600">·</span>
            <span className="text-[11px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>

          {/* Vote bar */}
          <div className="mt-2.5 h-1 w-full rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/topic/${topic.id}`}
            className="p-1.5 rounded-lg text-surface-600 hover:text-white hover:bg-surface-300 transition-all"
            aria-label="Open topic"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {isOwner && (
            <button
              onClick={handleRemove}
              disabled={removing}
              aria-label="Remove from collection"
              className="p-1.5 rounded-lg text-surface-600 hover:text-against-400 hover:bg-against-500/10 transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Editable name ────────────────────────────────────────────────────────────

function EditableHeader({
  collection,
  onSave,
}: {
  collection: CollectionDetail
  onSave: (updates: { name: string; description: string | null; is_public: boolean }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [isPublic, setIsPublic] = useState(collection.is_public)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, is_public: isPublic }),
      })
      if (res.ok) {
        onSave({ name: name.trim(), description: description.trim() || null, is_public: isPublic })
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-white truncate">{collection.name}</h1>
            {collection.is_public ? (
              <Globe className="h-3.5 w-3.5 text-for-400 shrink-0" aria-label="Public" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-surface-600 shrink-0" aria-label="Private" />
            )}
          </div>
          {collection.description && (
            <p className="text-sm font-mono text-surface-400 mt-0.5">{collection.description}</p>
          )}
        </div>
        {collection.is_owner && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-all"
            aria-label="Edit collection"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        className={cn(
          'w-full px-3 py-2 rounded-xl font-mono text-lg font-bold text-white',
          'bg-surface-200 border border-surface-300 focus:outline-none focus:border-for-500/60'
        )}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Description (optional)"
        className={cn(
          'w-full px-3 py-2 rounded-xl font-mono text-sm text-white resize-none',
          'bg-surface-200 border border-surface-300 focus:outline-none focus:border-for-500/60',
          'placeholder:text-surface-500'
        )}
      />
      <button
        onClick={() => setIsPublic((p) => !p)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-mono transition-all',
          isPublic
            ? 'bg-for-600/20 border-for-600/40 text-for-300'
            : 'bg-surface-200 border-surface-300 text-surface-500'
        )}
      >
        {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {isPublic ? 'Public' : 'Private'}
      </button>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button size="sm" disabled={!name.trim() || saving} onClick={save}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [topics, setTopics] = useState<CollectionTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/collections/${params.id}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (res.ok) {
        const json = await res.json()
        setCollection(json.collection)
        setTopics(json.collection.topics)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemoveTopic(topicId: string) {
    if (!collection) return
    // Optimistic update
    setTopics((prev) => prev.filter((t) => t.id !== topicId))
    setCollection((prev) => prev ? { ...prev, item_count: Math.max(0, prev.item_count - 1) } : prev)

    await fetch(`/api/collections/${collection.id}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId }),
    })
  }

  function handleHeaderSave(updates: { name: string; description: string | null; is_public: boolean }) {
    setCollection((prev) => prev ? { ...prev, ...updates } : prev)
  }

  async function handleDeleteCollection() {
    if (!collection || !confirm(`Delete "${collection.name}"? This cannot be undone.`)) return
    await fetch(`/api/collections/${collection.id}`, { method: 'DELETE' })
    router.push('/collections')
  }

  if (notFound) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-0">
        <TopBar />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-16">
          <EmptyState
            icon={Layers}
            title="Collection not found"
            description="This collection may have been deleted or is private."
            actions={[{ label: 'Browse collections', onClick: () => router.push('/collections') }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/collections"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to collections"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-mono text-surface-500">Collections</span>
        </div>

        {loading ? (
          <DetailSkeleton />
        ) : collection ? (
          <>
            {/* Header */}
            <div className="mb-5">
              <EditableHeader collection={collection} onSave={handleHeaderSave} />

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-surface-600">
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {collection.item_count} topic{collection.item_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated {relativeTime(collection.updated_at)}
                </span>
                {collection.owner && (
                  <span className="flex items-center gap-1">
                    by{' '}
                    <Link
                      href={`/profile/${collection.owner.username}`}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <Avatar
                        src={collection.owner.avatar_url}
                        fallback={collection.owner.display_name || collection.owner.username}
                        size="xs"
                      />
                      @{collection.owner.username}
                    </Link>
                  </span>
                )}
              </div>

              {/* Owner actions */}
              {collection.is_owner && (
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/?collection=${collection.id}`}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                      'bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400',
                      'hover:border-surface-400 hover:text-white transition-all'
                    )}
                  >
                    <Layers className="h-3 w-3" />
                    Add from Feed
                  </Link>
                  <button
                    onClick={handleDeleteCollection}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl ml-auto',
                      'bg-surface-200 border border-surface-300 text-xs font-mono text-surface-600',
                      'hover:border-against-500/40 hover:text-against-400 hover:bg-against-500/10 transition-all'
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Collection
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-surface-300 mb-4" />

            {/* Topics */}
            {topics.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No topics yet"
                description={
                  collection.is_owner
                    ? 'Use the "Add to Collection" button on any topic to add it here.'
                    : 'This collection is empty.'
                }
              />
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {topics.map((t) => (
                    <TopicRow
                      key={t.id}
                      topic={t}
                      isOwner={collection.is_owner}
                      onRemove={handleRemoveTopic}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
