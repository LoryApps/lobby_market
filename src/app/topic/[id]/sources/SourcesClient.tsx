'use client'

/**
 * /topic/[id]/sources — Curated Source Library
 *
 * Shows the up-to-5 factual sources the topic author or moderators have
 * pinned to this debate. Separate from the community evidence board
 * (/topic/[id]/evidence), these are hand-curated authoritative references.
 *
 * Topic author + moderators can add / delete sources.
 * Everyone else can read and click through.
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Plus,
  Scale,
  Shield,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { TopicSource } from '@/app/api/topics/[id]/sources/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SOURCES = 5

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'Law',
  failed:   'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function faviconUrl(domain: string | null): string {
  if (!domain) return ''
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

// ─── Source card ──────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: TopicSource
  canManage: boolean
  onDelete: (id: string) => void
  deleting: boolean
}

function SourceCard({ source, canManage, onDelete, deleting }: SourceCardProps) {
  const profile = source.added_by_profile

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'relative group rounded-xl border border-surface-300 bg-surface-200',
        'hover:border-for-500/40 hover:bg-surface-200/80 transition-colors'
      )}
    >
      {/* Main link area */}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4"
      >
        {/* Domain row */}
        <div className="flex items-center gap-2 mb-2">
          {source.domain && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faviconUrl(source.domain)}
              alt=""
              className="w-4 h-4 rounded-sm flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className="text-xs text-surface-500 font-mono truncate">
            {source.domain ?? new URL(source.url).hostname}
          </span>
          <ExternalLink className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-white leading-snug mb-1 line-clamp-2 group-hover:text-for-300 transition-colors">
          {source.title}
        </p>

        {/* Description */}
        {source.description && (
          <p className="text-xs text-surface-500 leading-relaxed line-clamp-2 mb-3">
            {source.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2">
          {profile && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={profile.avatar_url}
                username={profile.username}
                size="xs"
              />
              <span className="text-xs text-surface-500">
                {profile.display_name ?? profile.username}
              </span>
            </div>
          )}
          <span className="text-xs text-surface-600 ml-auto">
            {relativeTime(source.created_at)}
          </span>
        </div>
      </a>

      {/* Delete button (only for managers) */}
      {canManage && (
        <button
          onClick={() => onDelete(source.id)}
          disabled={deleting}
          aria-label="Remove source"
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-lg',
            'text-surface-600 hover:text-against-400 hover:bg-against-500/10',
            'transition-colors opacity-0 group-hover:opacity-100',
            deleting && 'opacity-50 pointer-events-none'
          )}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </motion.div>
  )
}

// ─── Add source form ──────────────────────────────────────────────────────────

interface AddSourceFormProps {
  topicId: string
  onAdded: (source: TopicSource) => void
  onCancel: () => void
}

function AddSourceForm({ topicId, onAdded, onCancel }: AddSourceFormProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    const trimmedUrl = url.trim()
    const trimmedTitle = title.trim()
    if (!trimmedUrl || !trimmedTitle) {
      setError('URL and title are required')
      return
    }
    try {
      new URL(trimmedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl, title: trimmedTitle, description: description.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to add source')
        return
      }
      onAdded(json.source as TopicSource)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }, [url, title, description, topicId, onAdded])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-for-500/40 bg-surface-200 p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-white">Pin a Source</p>
        <button
          onClick={onCancel}
          className="p-1 rounded text-surface-500 hover:text-white transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* URL */}
      <div>
        <label className="block text-xs text-surface-500 mb-1">URL <span className="text-against-400">*</span></label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className={cn(
            'w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/60',
            'transition-colors'
          )}
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-surface-500 mb-1">Title <span className="text-against-400">*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article or report title"
          maxLength={200}
          className={cn(
            'w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/60',
            'transition-colors'
          )}
        />
        <p className="text-right text-xs text-surface-600 mt-0.5">{title.length}/200</p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-surface-500 mb-1">Why this source? <span className="text-surface-600">(optional)</span></label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief note on what this source demonstrates"
          rows={2}
          maxLength={500}
          className={cn(
            'w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-surface-600 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/60',
            'transition-colors'
          )}
        />
        <p className="text-right text-xs text-surface-600 mt-0.5">{description.length}/500</p>
      </div>

      {error && (
        <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="for"
          size="sm"
          onClick={submit}
          disabled={submitting || !url.trim() || !title.trim()}
          className="flex-1"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {submitting ? 'Pinning…' : 'Pin Source'}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  topicBluePct: number
  topicTotalVotes: number
  currentUserId: string | null
  canManage: boolean
  initialSources: TopicSource[]
}

export function SourcesClient({
  topicId,
  topicStatement,
  topicCategory,
  topicStatus,
  topicBluePct,
  topicTotalVotes,
  currentUserId,
  canManage,
  initialSources,
}: Props) {
  const [sources, setSources] = useState<TopicSource[]>(initialSources)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const forPct  = Math.round(topicBluePct)
  const agPct   = 100 - forPct
  const atLimit = sources.length >= MAX_SOURCES

  // ── Add handler ──
  const handleAdded = useCallback((source: TopicSource) => {
    setSources((prev) => [...prev, source])
    setShowForm(false)
  }, [])

  // ── Delete handler ──
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/topics/${topicId}/sources?sourceId=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }, [topicId])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">

        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {/* Topic header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {topicCategory && (
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                {topicCategory}
              </span>
            )}
            <Badge variant={STATUS_BADGE[topicStatus] ?? 'proposed'}>
              {STATUS_LABEL[topicStatus] ?? topicStatus}
            </Badge>
          </div>
          <h1 className="text-lg font-semibold text-white leading-snug mb-3">
            {topicStatement}
          </h1>

          {/* Vote split */}
          <div className="flex items-center gap-3 text-xs text-surface-500">
            <span className="text-for-400 font-medium">{forPct}% For</span>
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-against-400 font-medium">{agPct}% Against</span>
            <span className="text-surface-600">
              {topicTotalVotes.toLocaleString()} votes
            </span>
          </div>
        </div>

        {/* Page title row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-for-400" />
            <h2 className="text-base font-semibold text-white">
              Curated Sources
            </h2>
            <span className="text-xs text-surface-600 bg-surface-300 px-2 py-0.5 rounded-full">
              {sources.length}/{MAX_SOURCES}
            </span>
          </div>

          {canManage && !showForm && !atLimit && (
            <Button
              variant="for"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Pin Source
            </Button>
          )}
        </div>

        {/* Explainer */}
        <p className="text-xs text-surface-500 mb-5 leading-relaxed">
          Up to {MAX_SOURCES} factual sources curated by the topic author and moderators.
          These references help the community ground the debate in evidence.
        </p>

        {/* Add form */}
        <AnimatePresence mode="popLayout">
          {showForm && (
            <div className="mb-4" key="form">
              <AddSourceForm
                topicId={topicId}
                onAdded={handleAdded}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* At limit notice */}
        {canManage && atLimit && !showForm && (
          <div className="mb-4 rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 flex items-center gap-3 text-xs text-surface-500">
            <Lock className="h-4 w-4 flex-shrink-0 text-surface-600" />
            Maximum {MAX_SOURCES} sources reached. Remove one to add another.
          </div>
        )}

        {/* Sources list */}
        <AnimatePresence mode="popLayout">
          {sources.length > 0 ? (
            <div className="space-y-3">
              {sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  canManage={canManage}
                  onDelete={handleDelete}
                  deleting={deletingId === source.id}
                />
              ))}
            </div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Globe className="h-10 w-10 text-surface-600 mx-auto mb-4" />
              <p className="text-surface-500 font-medium mb-1">No sources pinned yet</p>
              <p className="text-sm text-surface-600">
                {canManage
                  ? 'Pin up to 5 authoritative sources to ground this debate in evidence.'
                  : 'The topic author hasn\'t pinned any sources yet.'}
              </p>
              {canManage && (
                <Button
                  variant="for"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  className="mt-4"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Pin First Source
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider + community evidence link */}
        {sources.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-surface-500" />
              <p className="text-sm text-surface-400 font-medium">More from the community</p>
            </div>
            <p className="text-xs text-surface-500 mb-4">
              The community evidence board has additional sources submitted and voted on by all participants.
            </p>
            <Link
              href={`/topic/${topicId}/evidence`}
              className={cn(
                'inline-flex items-center gap-2 text-sm font-medium',
                'text-for-400 hover:text-for-300 transition-colors'
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              Browse community evidence
            </Link>
          </div>
        )}

        {/* Non-manager, logged-out notice */}
        {!currentUserId && (
          <div className="mt-6 rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 text-xs text-surface-500 flex items-center gap-2">
            <Lock className="h-4 w-4 flex-shrink-0" />
            Sign in to suggest sources via the{' '}
            <Link href={`/topic/${topicId}/evidence`} className="text-for-400 hover:underline">
              community evidence board
            </Link>.
          </div>
        )}

        {/* Nav links */}
        <div className="mt-8 pt-6 border-t border-surface-300 grid grid-cols-2 gap-3">
          {[
            { href: `/topic/${topicId}/arguments`, icon: Zap, label: 'Arguments' },
            { href: `/topic/${topicId}/evidence`, icon: Shield, label: 'Evidence Board' },
            { href: `/topic/${topicId}/brief`, icon: BookOpen, label: 'AI Brief' },
            { href: `/topic/${topicId}/synthesis`, icon: Scale, label: 'Synthesis' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl',
                'border border-surface-300 bg-surface-200',
                'text-sm text-surface-400 hover:text-white hover:border-surface-400',
                'transition-colors'
              )}
            >
              <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
