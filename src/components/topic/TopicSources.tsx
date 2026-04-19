'use client'

/**
 * TopicSources
 *
 * Displays pinned factual citations for a topic. Topic authors and moderators
 * can add up to 5 sources. Any visitor can see them.
 */

import { useEffect, useRef, useState } from 'react'
import { BookOpen, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface TopicSource {
  id: string
  topic_id: string
  added_by: string
  url: string
  title: string
  description: string | null
  domain: string | null
  display_order: number
  created_at: string
  added_by_profile: SourceProfile | null
}

// ─── Favicon helper ───────────────────────────────────────────────────────────

function FaviconIcon({ domain }: { domain: string | null }) {
  const [errored, setErrored] = useState(false)

  if (!domain || errored) {
    return (
      <div className="flex items-center justify-center h-5 w-5 rounded bg-surface-300 shrink-0">
        <BookOpen className="h-2.5 w-2.5 text-surface-500" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 rounded shrink-0 bg-surface-300"
      onError={() => setErrored(true)}
    />
  )
}

// ─── Single source row ────────────────────────────────────────────────────────

function SourceRow({
  source,
  canDelete,
  onDelete,
}: {
  source: TopicSource
  canDelete: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    onDelete(source.id)
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3 transition-colors hover:border-gold/30 hover:bg-surface-200">
      <FaviconIcon domain={source.domain} />

      <div className="min-w-0 flex-1">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 group/link"
        >
          <span className="text-[13px] font-medium text-white line-clamp-1 group-hover/link:text-gold transition-colors">
            {source.title}
          </span>
          <ExternalLink className="h-3 w-3 text-surface-500 group-hover/link:text-gold shrink-0 transition-colors" />
        </a>

        {source.domain && (
          <p className="mt-0.5 text-[11px] font-mono text-surface-500 line-clamp-1">
            {source.domain}
          </p>
        )}

        {source.description && (
          <p className="mt-1 text-[12px] text-surface-400 line-clamp-2 leading-snug">
            {source.description}
          </p>
        )}
      </div>

      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-against-500/10 text-surface-500 hover:text-against-400 disabled:opacity-50"
          title="Remove source"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

// ─── Add source form ──────────────────────────────────────────────────────────

interface AddSourceFormProps {
  topicId: string
  onAdd: (source: TopicSource) => void
  onClose: () => void
}

function AddSourceForm({ topicId, onAdd, onClose }: AddSourceFormProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    urlRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim(), description: description.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to add source')
        setSaving(false)
        return
      }

      onAdd(data.source as TopicSource)
    } catch {
      setError('Network error — please try again')
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-surface-300 bg-surface-300/50 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors'

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gold/30 bg-surface-200/80 p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-white">Add a source</p>
        <button
          type="button"
          onClick={onClose}
          className="text-surface-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-mono text-surface-500 mb-1 uppercase tracking-wider">
          URL *
        </label>
        <input
          ref={urlRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[11px] font-mono text-surface-500 mb-1 uppercase tracking-wider">
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief descriptive title"
          required
          maxLength={200}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-[11px] font-mono text-surface-500 mb-1 uppercase tracking-wider">
          Description <span className="normal-case text-surface-600">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why is this relevant? What does it show?"
          rows={2}
          maxLength={400}
          className={cn(inputCls, 'resize-none')}
        />
      </div>

      {error && (
        <p className="text-[12px] text-against-400 font-mono">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-[13px] text-surface-500 hover:text-white transition-colors rounded-lg hover:bg-surface-300/50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !url.trim() || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-[13px] font-semibold text-gold hover:bg-gold/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Pin source
        </button>
      </div>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopicSourcesProps {
  topicId: string
  topicAuthorId: string
}

export function TopicSources({ topicId, topicAuthorId }: TopicSourcesProps) {
  const [sources, setSources] = useState<TopicSource[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Fetch current user once
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setCurrentRole(data.role)
        })
    })
  }, [])

  // Load sources
  useEffect(() => {
    fetch(`/api/topics/${topicId}/sources`)
      .then((r) => r.json())
      .then(({ sources: data }) => {
        setSources(data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [topicId])

  const canAdd =
    currentUserId !== null &&
    sources.length < 5 &&
    (currentUserId === topicAuthorId ||
      currentRole === 'troll_catcher' ||
      currentRole === 'elder')

  function handleAdd(source: TopicSource) {
    setSources((prev) => [...prev, source])
    setShowForm(false)
  }

  async function handleDelete(sourceId: string) {
    const res = await fetch(
      `/api/topics/${topicId}/sources?sourceId=${sourceId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setSources((prev) => prev.filter((s) => s.id !== sourceId))
    }
  }

  // Don't render if loading and no sources and user can't add
  if (!loading && sources.length === 0 && !canAdd) return null

  return (
    <section className="space-y-3" aria-label="Pinned sources">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gold" />
          <h3 className="text-[13px] font-mono font-semibold text-surface-400 uppercase tracking-widest">
            Sources
          </h3>
          {sources.length > 0 && (
            <span className="text-[11px] font-mono text-surface-600 tabular-nums">
              {sources.length}/{5}
            </span>
          )}
        </div>

        {canAdd && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[12px] font-mono text-surface-500 hover:text-gold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add source
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-surface-200/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Source list */}
      {!loading && sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((source) => {
            const canDelete =
              currentUserId !== null &&
              (source.added_by === currentUserId ||
                currentUserId === topicAuthorId ||
                currentRole === 'troll_catcher' ||
                currentRole === 'elder')

            return (
              <SourceRow
                key={source.id}
                source={source}
                canDelete={canDelete}
                onDelete={handleDelete}
              />
            )
          })}
        </div>
      )}

      {/* Empty state for contributors */}
      {!loading && sources.length === 0 && canAdd && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-surface-400 bg-surface-200/30 px-4 py-4 text-[13px] text-surface-500 hover:border-gold/40 hover:text-gold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Pin a factual source for this topic
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <AddSourceForm
          topicId={topicId}
          onAdd={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}
    </section>
  )
}
