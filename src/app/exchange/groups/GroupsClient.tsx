'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FolderOpen,
  Globe,
  Layers,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ExchangeGroup, GroupsResponse } from '@/app/api/exchange/groups/route'

// ─── Helpers ──────────────────────────────────────────��───────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Create Group Modal ───────────────────────────────────────────────────────

const EMOJI_OPTIONS = ['📊', '🌍', '⚖️', '💡', '🏛️', '🔬', '💰', '🌱', '🛡️', '🎯', '🔥', '⚡', '🏆', '🧭', '🔮']

interface CreateModalProps {
  onClose: () => void
  onCreate: (group: ExchangeGroup) => void
}

function CreateGroupModal({ onClose, onCreate }: CreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📊')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, emoji, is_public: isPublic }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Failed to create group')
        return
      }
      const group = await res.json() as ExchangeGroup
      onCreate(group)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-100 border border-surface-300 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-lg font-bold text-white">New Market Group</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-300 transition-colors">
            <X className="h-4 w-4 text-surface-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'h-9 w-9 rounded-xl text-lg flex items-center justify-center border transition-all',
                    emoji === e
                      ? 'bg-for-500/20 border-for-500/50 scale-110'
                      : 'bg-surface-200 border-surface-400 hover:border-surface-300'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-1.5">Name <span className="text-against-400">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Climate Policy Watch"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-400 text-white placeholder:text-surface-600 font-mono text-sm focus:outline-none focus:border-for-500/60 transition-colors"
            />
            <p className="text-[11px] font-mono text-surface-600 mt-1">{name.length}/80</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-surface-500 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Optional — describe your market thesis…"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-400 text-white placeholder:text-surface-600 font-mono text-sm focus:outline-none focus:border-for-500/60 transition-colors resize-none"
            />
            <p className="text-[11px] font-mono text-surface-600 mt-1">{description.length}/300</p>
          </div>

          {/* Visibility */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-surface-400 cursor-pointer hover:border-surface-300 transition-colors">
            <div className={cn('h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isPublic ? 'bg-for-500 border-for-500' : 'border-surface-500')}>
              {isPublic && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <input type="checkbox" className="sr-only" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <div>
              <p className="text-sm font-mono text-white">Make public</p>
              <p className="text-[11px] font-mono text-surface-500">Other users can view this group</p>
            </div>
            {isPublic ? <Globe className="h-4 w-4 text-for-400 ml-auto" /> : <Lock className="h-4 w-4 text-surface-500 ml-auto" />}
          </label>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-950/40 border border-against-800/40 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface-200 border border-surface-400 text-surface-400 font-mono text-sm hover:border-surface-300 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 border border-for-500/40 text-white font-mono text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Group
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Group Card ────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: ExchangeGroup
  isOwn?: boolean
  onDelete?: (id: string) => void
}

function GroupCard({ group, isOwn, onDelete }: GroupCardProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/exchange/groups/${group.id}`, { method: 'DELETE' })
      onDelete?.(group.id)
    } catch {
      // best effort
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Link href={`/exchange/groups/${group.id}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-200 hover:bg-surface-150 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-surface-200 border border-surface-400 flex items-center justify-center text-xl flex-shrink-0">
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-white truncate">{group.name}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {group.is_public
                  ? <Badge variant="outline" className="text-[10px] text-for-400 border-for-500/30 bg-for-500/8 py-0 px-1.5"><Globe className="h-2.5 w-2.5 mr-0.5" />Public</Badge>
                  : <Badge variant="outline" className="text-[10px] text-surface-500 border-surface-500/30 py-0 px-1.5"><Lock className="h-2.5 w-2.5 mr-0.5" />Private</Badge>
                }
                {isOwn && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    aria-label="Delete group"
                    className="p-1 rounded-md text-surface-600 hover:text-against-400 hover:bg-against-900/20 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
            {group.description && (
              <p className="text-[11px] font-mono text-surface-500 mt-0.5 line-clamp-2">{group.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {group.item_count} {group.item_count === 1 ? 'market' : 'markets'}
              </span>
              <span className="text-[11px] font-mono text-surface-600">{relTime(group.updated_at)}</span>
              {!isOwn && group.owner_username && (
                <span className="text-[11px] font-mono text-surface-600 ml-auto">by @{group.owner_username}</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Main ─────────��───────────────────────────────────────────────────────────

export function GroupsClient() {
  const router = useRouter()
  const [data, setData] = useState<GroupsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<'mine' | 'public'>('mine')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/groups')
      if (res.ok) setData(await res.json() as GroupsResponse)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleCreated(group: ExchangeGroup) {
    setShowCreate(false)
    setData((prev) => prev
      ? { ...prev, mine: [group, ...prev.mine] }
      : { mine: [group], public: [] }
    )
    router.push(`/exchange/groups/${group.id}`)
  }

  function handleDeleted(id: string) {
    setData((prev) => prev ? { ...prev, mine: prev.mine.filter((g) => g.id !== id) } : prev)
  }

  const displayGroups = activeTab === 'mine' ? (data?.mine ?? []) : (data?.public ?? [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/exchange" className="p-2 rounded-xl bg-surface-200 border border-surface-400 hover:border-surface-300 transition-colors">
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
              <FolderOpen className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Market Groups</h1>
              <p className="text-xs font-mono text-surface-500">Thematic market baskets</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-for-600 hover:bg-for-500 border border-for-500/40 text-white font-mono text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Group
          </button>
        </div>

        {/* Explainer */}
        <div className="rounded-xl bg-purple/8 border border-purple/20 p-4 mb-5 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            Groups are thematic baskets of Exchange markets — like your own civic index. Add related markets, track their aggregate consensus, and share your thesis publicly.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['mine', 'public'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-semibold border transition-all',
                activeTab === tab
                  ? 'bg-surface-200 border-surface-300 text-white'
                  : 'bg-transparent border-surface-500/30 text-surface-500 hover:border-surface-400'
              )}
            >
              {tab === 'mine' ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              {tab === 'mine' ? 'My Groups' : 'Public Groups'}
              {tab === 'mine' && data && (
                <span className="ml-1 text-surface-600">({data.mine.length})</span>
              )}
            </button>
          ))}
          <Link
            href="/exchange/groups/leaderboard"
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-200 border border-surface-400 hover:border-gold/40 hover:text-gold text-surface-500 font-mono text-xs font-semibold transition-colors"
          >
            <Trophy className="h-3 w-3" />
            Top
          </Link>
          <button onClick={load} className="p-2 rounded-xl bg-surface-200 border border-surface-400 hover:border-surface-300 transition-colors">
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayGroups.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={activeTab === 'mine' ? 'No groups yet' : 'No public groups'}
            description={
              activeTab === 'mine'
                ? 'Create your first market group to organise related civic markets into a thematic basket.'
                : 'No public groups have been created yet. Be the first to share one.'
            }
            action={activeTab === 'mine' ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 border border-for-500/40 text-white font-mono text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create First Group
              </button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {displayGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  isOwn={activeTab === 'mine'}
                  onDelete={handleDeleted}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Exchange link */}
        <div className="mt-8 pt-4 border-t border-surface-300/50">
          <Link
            href="/exchange"
            className="flex items-center justify-between p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-gold" />
              </div>
              <span className="font-mono text-sm text-white">Browse Exchange Markets</span>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showCreate && (
          <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
        )}
      </AnimatePresence>
    </div>
  )
}
