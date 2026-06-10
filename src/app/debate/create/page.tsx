'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Layers, Search, Mic, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { Topic, DebateType, DebateSeries } from '@/lib/supabase/types'

const DEBATE_TYPES: Array<{
  value: DebateType
  label: string
  duration: string
  desc: string
}> = [
  {
    value: 'quick',
    label: 'Quick',
    duration: '15 min',
    desc: 'Tight-format sprint. Opening, rebuttal, closing.',
  },
  {
    value: 'grand',
    label: 'Grand',
    duration: '45 min',
    desc: 'Full format with cross-examination and audience Q&A.',
  },
  {
    value: 'tribunal',
    label: 'Tribunal',
    duration: '60 min',
    desc: 'Elder-moderated tribunal. Maximum stakes.',
  },
]

function getMinDateTime(): string {
  // 10 minutes + a small buffer in the future, rounded up to the minute.
  const d = new Date(Date.now() + 11 * 60 * 1000)
  d.setSeconds(0, 0)
  // Format as YYYY-MM-DDTHH:mm in local time for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CreateDebatePage() {
  const router = useRouter()
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [searching, setSearching] = useState(false)
  const [type, setType] = useState<DebateType>('quick')
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    getMinDateTime()
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Series assignment
  const [seriesExpanded, setSeriesExpanded] = useState(false)
  const [seriesQuery, setSeriesQuery] = useState('')
  const [seriesResults, setSeriesList] = useState<DebateSeries[]>([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [selectedSeries, setSelectedSeries] = useState<DebateSeries | null>(null)

  const minDateTime = useMemo(() => getMinDateTime(), [])

  // Series autocomplete — load user's ongoing series
  useEffect(() => {
    if (!seriesExpanded) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSeriesLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        let query = supabase
          .from('debate_series')
          .select('id, title, description, format, blue_wins, red_wins, status, creator_id, topic_id, winner_side, created_at, updated_at')
          .eq('status', 'ongoing')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
          .abortSignal(controller.signal)
        if (seriesQuery.trim()) {
          query = query.ilike('title', `%${seriesQuery.trim()}%`)
        }
        const { data } = await query
        setSeriesList((data as DebateSeries[]) ?? [])
      } catch {
        // ignore abort
      } finally {
        setSeriesLoading(false)
      }
    }, 200)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [seriesExpanded, seriesQuery])

  // Topic autocomplete
  useEffect(() => {
    if (!topicQuery.trim() || selectedTopic) {
      setTopicResults([])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('topics')
          .select('*')
          .in('status', ['active', 'voting', 'proposed', 'continued'])
          .ilike('statement', `%${topicQuery.trim()}%`)
          .order('feed_score', { ascending: false })
          .limit(10)
          .abortSignal(controller.signal)

        setTopicResults((data as Topic[]) ?? [])
      } catch {
        // ignore abort / network errors
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [topicQuery, selectedTopic])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!selectedTopic) e.topic = 'Please select a topic'
    if (!title.trim()) e.title = 'Title is required'
    if (title.length > 200) e.title = 'Title must be 200 characters or fewer'
    if (!scheduledAt) {
      e.scheduled = 'Scheduled time is required'
    } else {
      const t = new Date(scheduledAt).getTime()
      if (Number.isNaN(t)) e.scheduled = 'Invalid date/time'
      else if (t - Date.now() < 10 * 60 * 1000)
        e.scheduled = 'Must be at least 10 minutes in the future'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    if (!selectedTopic) return

    setIsSubmitting(true)
    setErrors({})
    try {
      const scheduledIso = new Date(scheduledAt).toISOString()
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          type,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduled_at: scheduledIso,
          series_id: selectedSeries?.id ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setErrors({ form: data.error || 'Failed to create debate' })
        return
      }

      const debate = await res.json()
      router.push(`/debate/${debate.id}`)
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-against-400" />
            <span className="text-sm font-medium text-white">
              Schedule Debate
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form-level error */}
          {errors.form && (
            <div className="bg-against-600/10 border border-against-600/30 text-against-400 text-sm rounded-lg px-4 py-3">
              {errors.form}
            </div>
          )}

          {/* Topic selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-surface-600">
              Topic
            </label>
            {selectedTopic ? (
              <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-surface-200 border border-for-500/30">
                <p className="text-sm text-white line-clamp-2">
                  {selectedTopic.statement}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic(null)
                    setTopicQuery('')
                  }}
                  className="text-xs text-surface-500 hover:text-white flex-shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                <input
                  type="text"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Search active topics..."
                  className={cn(
                    'w-full h-11 pl-10 pr-4 rounded-xl',
                    'bg-surface-200 border border-surface-300 text-sm text-white placeholder:text-surface-500',
                    'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20 transition-colors'
                  )}
                />
                {topicQuery.trim() && topicResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface-200 border border-surface-300 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-20">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(t)
                          setTopicQuery(t.statement)
                          setTopicResults([])
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-surface-300 text-sm text-surface-700 border-b border-surface-300 last:border-0 transition-colors"
                      >
                        <div className="text-white line-clamp-2">
                          {t.statement}
                        </div>
                        <div className="text-[11px] font-mono text-surface-500 mt-1">
                          {t.category ?? 'Uncategorized'} ·{' '}
                          {t.total_votes.toLocaleString()} votes ·{' '}
                          {t.status.toUpperCase()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {topicQuery.trim() &&
                  !searching &&
                  topicResults.length === 0 && (
                    <p className="mt-2 text-xs text-surface-500">
                      No matching topics found.
                    </p>
                  )}
              </div>
            )}
            {errors.topic && (
              <p className="text-xs text-against-400">{errors.topic}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-surface-600">
              Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEBATE_TYPES.map((opt) => {
                const selected = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'text-left p-4 rounded-xl border transition-colors',
                      selected
                        ? 'bg-for-500/10 border-for-500 text-white'
                        : 'bg-surface-200 border-surface-300 text-surface-600 hover:border-surface-400'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-sm uppercase">
                        {opt.label}
                      </span>
                      <span className="text-[11px] font-mono text-surface-500">
                        {opt.duration}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-500 leading-snug">
                      {opt.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scheduled time */}
          <div className="space-y-2">
            <label
              htmlFor="scheduled_at"
              className="block text-sm font-medium text-surface-600"
            >
              Scheduled Time
            </label>
            <input
              id="scheduled_at"
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={cn(
                'w-full h-11 px-4 rounded-xl text-sm',
                'bg-surface-200 text-white border border-surface-300',
                'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20 transition-colors'
              )}
            />
            {errors.scheduled && (
              <p className="text-xs text-against-400">{errors.scheduled}</p>
            )}
            <p className="text-[11px] text-surface-500">
              Must be at least 10 minutes in the future.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-surface-600"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Encryption backdoors: safety or surveillance?"
              maxLength={200}
              className={cn(
                'w-full h-11 px-4 rounded-xl text-sm',
                'bg-surface-200 text-white border border-surface-300 placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20 transition-colors'
              )}
            />
            {errors.title && (
              <p className="text-xs text-against-400">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-surface-600"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what will be debated and the format."
              rows={4}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm',
                'bg-surface-200 text-white border-surface-300 placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 focus:border-for-500/50 focus:ring-for-500/20 transition-colors resize-none'
              )}
            />
          </div>

          {/* Series assignment (optional) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSeriesExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-surface-600 hover:text-white transition-colors"
            >
              <Layers className="h-4 w-4 text-purple" />
              Add to a Series
              <span className="text-xs text-surface-500 font-normal ml-1">(optional)</span>
              {seriesExpanded ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>

            {seriesExpanded && (
              <div className="space-y-2 pl-1">
                {selectedSeries ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-purple/10 border border-purple/30">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{selectedSeries.title}</p>
                      <p className="text-[11px] font-mono text-purple mt-0.5">
                        {selectedSeries.format.replace('best_of_', 'Best of ').replace('fixed', 'Fixed')} ·
                        {' '}{selectedSeries.blue_wins}–{selectedSeries.red_wins}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSeries(null)}
                      className="flex-shrink-0 text-surface-500 hover:text-white"
                      aria-label="Remove series"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                      <input
                        type="text"
                        value={seriesQuery}
                        onChange={(e) => setSeriesQuery(e.target.value)}
                        placeholder="Search your ongoing series..."
                        className={cn(
                          'w-full h-11 pl-10 pr-4 rounded-xl',
                          'bg-surface-200 border border-surface-300 text-sm text-white placeholder:text-surface-500',
                          'focus:outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/20 transition-colors'
                        )}
                      />
                    </div>
                    {seriesLoading && (
                      <p className="text-xs text-surface-500">Loading series…</p>
                    )}
                    {!seriesLoading && seriesResults.length > 0 && (
                      <div className="bg-surface-200 border border-surface-300 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                        {seriesResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSelectedSeries(s); setSeriesQuery('') }}
                            className="w-full text-left px-4 py-3 hover:bg-surface-300 text-sm border-b border-surface-300 last:border-0 transition-colors"
                          >
                            <div className="text-white font-medium truncate">{s.title}</div>
                            <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                              {s.format.replace('best_of_', 'Best of ').replace('fixed', 'Fixed')} ·
                              {' '}Score {s.blue_wins}–{s.red_wins}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {!seriesLoading && seriesResults.length === 0 && seriesExpanded && (
                      <p className="text-xs text-surface-500">
                        No ongoing series found.{' '}
                        <a href="/debate/series" className="text-purple hover:underline">Create one first.</a>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="for"
            size="lg"
            className="w-full"
            disabled={isSubmitting || !selectedTopic || !title.trim()}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Debate'}
          </Button>
        </form>
      </div>
    </div>
  )
}
