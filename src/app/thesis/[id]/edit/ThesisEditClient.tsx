'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Globe,
  Loader2,
  Lock,
  Save,
  Scroll,
  Sparkles,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ThesisCategory } from '@/lib/types/thesis'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_LABELS: Record<ThesisCategory, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

const CAT_COLORS: Record<ThesisCategory, { text: string; bg: string; border: string }> = {
  economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/40' },
  politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',      border: 'border-for-500/40' },
  technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/40' },
  science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/40' },
  ethics:      { text: 'text-against-400',   bg: 'bg-against-500/10',  border: 'border-against-500/40' },
  philosophy:  { text: 'text-surface-400',   bg: 'bg-surface-300/20',  border: 'border-surface-400/40' },
  culture:     { text: 'text-pink-400',      bg: 'bg-pink-500/10',     border: 'border-pink-500/40' },
  health:      { text: 'text-green-400',     bg: 'bg-green-500/10',    border: 'border-green-500/40' },
  environment: { text: 'text-teal-400',      bg: 'bg-teal-500/10',     border: 'border-teal-500/40' },
  education:   { text: 'text-indigo-400',    bg: 'bg-indigo-500/10',   border: 'border-indigo-500/40' },
}

const STATEMENT_MAX = 280
const RATIONALE_MAX = 1200

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  id: string
  initialStatement: string
  initialRationale: string
  initialCategory: string
  initialResolutionDate: string
  initialIsPublic: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThesisEditClient({
  id,
  initialStatement,
  initialRationale,
  initialCategory,
  initialResolutionDate,
  initialIsPublic,
}: Props) {
  const router = useRouter()

  const [statement, setStatement] = useState(initialStatement)
  const [rationale, setRationale] = useState(initialRationale)
  const [category, setCategory] = useState<ThesisCategory>(initialCategory as ThesisCategory)
  const [resolutionDate, setResolutionDate] = useState(initialResolutionDate)
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [showCatPicker, setShowCatPicker] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const statementLeft = STATEMENT_MAX - statement.length
  const rationaleLeft = RATIONALE_MAX - rationale.length
  const isDirty =
    statement !== initialStatement ||
    rationale !== initialRationale ||
    category !== initialCategory ||
    resolutionDate !== initialResolutionDate ||
    isPublic !== initialIsPublic
  const canSave = statement.trim().length >= 10 && isDirty && !saving

  const cat = CAT_COLORS[category]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/thesis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          rationale: rationale.trim() || undefined,
          category,
          resolution_date: resolutionDate || undefined,
          is_public: isPublic,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to save changes')
        return
      }
      router.push(`/thesis/${id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/thesis/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Failed to delete thesis')
        setDeleting(false)
        setConfirmDelete(false)
        return
      }
      router.push('/thesis/my')
    } catch {
      setError('Network error — please try again')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // Reset confirm-delete if user clicks elsewhere
  function handleBlurDelete() {
    setTimeout(() => setConfirmDelete(false), 200)
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/thesis/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to thesis"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Scroll className="h-4 w-4 text-purple" />
            <span className="text-sm font-mono text-surface-600">Edit Thesis</span>
          </div>
        </div>

        <motion.form
          onSubmit={handleSave}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* Statement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="statement" className="text-xs font-semibold text-surface-600 uppercase tracking-wider">
                Thesis Statement
              </label>
              <span className={cn('text-xs tabular-nums', statementLeft < 30 ? 'text-against-400' : 'text-surface-500')}>
                {statementLeft}
              </span>
            </div>
            <textarea
              id="statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={STATEMENT_MAX}
              rows={4}
              placeholder="Your bold civic prediction…"
              className="w-full rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 transition-colors resize-none px-3.5 py-3"
            />
          </div>

          {/* Rationale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="rationale" className="text-xs font-semibold text-surface-600 uppercase tracking-wider">
                Rationale <span className="text-surface-500 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <span className={cn('text-xs tabular-nums', rationaleLeft < 100 ? 'text-against-400' : 'text-surface-500')}>
                {rationaleLeft}
              </span>
            </div>
            <textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={RATIONALE_MAX}
              rows={5}
              placeholder="Why do you believe this? What evidence or reasoning supports it?"
              className="w-full rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 transition-colors resize-none px-3.5 py-3"
            />
          </div>

          {/* Category picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Category</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCatPicker((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 h-11 px-3.5 rounded-xl border text-sm font-medium transition-colors',
                  cat.bg, cat.border, cat.text,
                )}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 opacity-70" />
                  {CAT_LABELS[category]}
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showCatPicker && 'rotate-180')} />
              </button>

              {showCatPicker && (
                <div className="absolute z-20 top-full mt-1 w-full rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden">
                  {THESIS_CATEGORIES.map((c) => {
                    const cc = CAT_COLORS[c]
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCategory(c); setShowCatPicker(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3.5 py-2.5 text-sm transition-colors',
                          c === category
                            ? cn(cc.bg, cc.text)
                            : 'text-surface-600 hover:bg-surface-300 hover:text-white',
                        )}
                      >
                        {CAT_LABELS[c]}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Resolution date */}
          <div className="space-y-2">
            <label htmlFor="resolution-date" className="text-xs font-semibold text-surface-600 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Resolution Date <span className="text-surface-500 font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="resolution-date"
              type="date"
              value={resolutionDate}
              min={minDateStr}
              onChange={(e) => setResolutionDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/30 transition-colors"
            />
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
            <div className="flex items-center gap-2.5">
              {isPublic ? (
                <Globe className="h-4 w-4 text-for-400" />
              ) : (
                <Lock className="h-4 w-4 text-surface-500" />
              )}
              <div>
                <p className="text-sm font-medium text-white">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-xs text-surface-500">
                  {isPublic ? 'Anyone can read and vote on your thesis' : 'Only you can see this thesis'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none',
                isPublic ? 'bg-for-500' : 'bg-surface-400',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform mt-0.5',
                  isPublic ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="for"
              disabled={!canSave}
              className="flex-1 gap-2 font-mono font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>

            <button
              type="button"
              onClick={handleDelete}
              onBlur={handleBlurDelete}
              disabled={deleting}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                confirmDelete
                  ? 'bg-against-500/20 text-against-300 border border-against-500/40 hover:bg-against-500/30'
                  : 'bg-surface-200 text-surface-500 border border-surface-300 hover:bg-surface-300 hover:text-against-400',
              )}
              aria-label={confirmDelete ? 'Confirm delete thesis' : 'Delete thesis'}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          </div>

          <p className="text-xs text-surface-600 text-center">
            Editing is only available while your thesis is active.
            Once resolved, the original text is preserved as the permanent record.
          </p>
        </motion.form>
      </main>

      <BottomNav />
    </div>
  )
}
