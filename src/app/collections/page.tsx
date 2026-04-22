'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronRight,
  Clock,
  Globe,
  Layers,
  Loader2,
  Lock,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CollectionSummary, CollectionsResponse } from '@/app/api/collections/route'

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CollectionSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-72 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Create Collection Modal ──────────────────────────────────────────────────

function CreateCollectionModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (c: CollectionSummary) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 50)
      setName('')
      setDescription('')
      setIsPublic(false)
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, is_public: isPublic }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create collection')
        return
      }
      const json = await res.json()
      onCreate(json.collection)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
          >
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-base font-bold text-white">New Collection</h2>
                <button
                  onClick={onClose}
                  className="text-surface-500 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-surface-500 mb-1.5">
                    Collection name <span className="text-against-400">*</span>
                  </label>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Economic Reform Watch"
                    className={cn(
                      'w-full px-3 py-2 rounded-xl text-sm font-mono text-white',
                      'bg-surface-200 border border-surface-300',
                      'focus:outline-none focus:border-for-500/60',
                      'placeholder:text-surface-500'
                    )}
                  />
                  <p className="text-[10px] font-mono text-surface-600 mt-1 text-right">
                    {name.length}/80
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-surface-500 mb-1.5">
                    Description <span className="text-surface-600">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="What is this collection about?"
                    className={cn(
                      'w-full px-3 py-2 rounded-xl text-sm font-mono text-white resize-none',
                      'bg-surface-200 border border-surface-300',
                      'focus:outline-none focus:border-for-500/60',
                      'placeholder:text-surface-500'
                    )}
                  />
                  <p className="text-[10px] font-mono text-surface-600 mt-1 text-right">
                    {description.length}/300
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublic((p) => !p)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2.5 rounded-xl',
                    'border transition-all text-sm font-mono',
                    isPublic
                      ? 'bg-for-600/20 border-for-600/40 text-for-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500'
                  )}
                >
                  {isPublic ? (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      <span>Public — anyone can view this collection</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Private — only you can see this</span>
                    </>
                  )}
                </button>

                {error && (
                  <p className="text-xs font-mono text-against-400">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!name.trim() || saving}
                    className="flex-1"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Collection card ──────────────────────────────────────────────────────────

function CollectionCard({
  collection,
  isOwner,
  onDelete,
}: {
  collection: CollectionSummary
  isOwner: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${collection.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/collections/${collection.id}`, { method: 'DELETE' })
      onDelete(collection.id)
    } catch {
      // best-effort
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Link
        href={`/collections/${collection.id}`}
        className={cn(
          'block bg-surface-100 border border-surface-300 rounded-2xl p-4',
          'hover:border-surface-400 transition-colors group'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-for-400 shrink-0" />
              <h3 className="font-mono text-sm font-semibold text-white truncate">
                {collection.name}
              </h3>
              {collection.is_public ? (
                <Globe className="h-3 w-3 text-surface-500 shrink-0" aria-label="Public" />
              ) : (
                <Lock className="h-3 w-3 text-surface-600 shrink-0" aria-label="Private" />
              )}
            </div>

            {collection.description && (
              <p className="text-xs font-mono text-surface-500 line-clamp-2 mb-2">
                {collection.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-[11px] font-mono text-surface-600">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {collection.item_count} topic{collection.item_count !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime(collection.updated_at)}
              </span>
              {!isOwner && collection.owner && (
                <span className="flex items-center gap-1">
                  <Avatar
                    src={collection.owner.avatar_url}
                    fallback={collection.owner.display_name || collection.owner.username}
                    size="xs"
                  />
                  @{collection.owner.username}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isOwner && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete collection"
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const router = useRouter()
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'mine' | 'public'>('mine')

  const load = useCallback(async (mode: 'mine' | 'public') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/collections?mode=${mode}`)
      if (res.ok) {
        const json: CollectionsResponse = await res.json()
        setCollections(json.collections)
        setIsAuthenticated(json.isAuthenticated)
        if (!json.isAuthenticated && mode === 'mine') {
          setTab('public')
        }
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  function handleCreated(c: CollectionSummary) {
    setCollections((prev) => [c, ...prev])
    router.push(`/collections/${c.id}`)
  }

  function handleDeleted(id: string) {
    setCollections((prev) => prev.filter((c) => c.id !== id))
  }

  const currentUserId = isAuthenticated ? collections.find((_c) => tab === 'mine')?.user_id : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono text-lg font-bold text-white">Collections</h1>
            <p className="text-xs font-mono text-surface-500">Curated topic playlists</p>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => setShowCreate(true)}
              className={cn(
                'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                'bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold',
                'transition-colors'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          )}
        </div>

        {/* Tabs */}
        {isAuthenticated && (
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-4">
            {(['mine', 'public'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                  tab === t
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {t === 'mine' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Lock className="h-3 w-3" /> My Collections
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <CollectionSkeleton />
        ) : collections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={tab === 'mine' ? 'No collections yet' : 'No public collections yet'}
            description={
              tab === 'mine'
                ? 'Create your first collection to organise topics by theme.'
                : 'No one has published a public collection yet.'
            }
            actions={
              isAuthenticated
                ? [{ label: 'Create collection', onClick: () => setShowCreate(true) }]
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {collections.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  isOwner={tab === 'mine' || (!!currentUserId && c.user_id === currentUserId)}
                  onDelete={handleDeleted}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Not logged in nudge */}
        {!isAuthenticated && !loading && (
          <div className="mt-6 p-4 bg-for-600/10 border border-for-600/30 rounded-2xl text-center">
            <BookmarkPlus className="h-8 w-8 text-for-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-surface-400 mb-3">
              Sign in to create and manage your own topic collections.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold rounded-xl transition-colors"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>

      <CreateCollectionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreated}
      />

      <BottomNav />
    </div>
  )
}
