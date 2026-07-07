'use client'

/**
 * /ama/host — Host an AMA Session
 *
 * Full-page creation form for civic experts who want to schedule a
 * live Ask Me Anything session on Lobby Market.
 *
 * Distinct from the quick inline modal in /ama, this page provides:
 *   - Richer context and tips for hosting a great session
 *   - Category-aware icon picker
 *   - Helpful date/time presets (Tomorrow 2pm, This weekend, Next week)
 *   - Live preview of how your session will appear on the AMA hub
 *   - Character-count feedback on title and description
 *   - Redirect to the new session page on success
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Mic,
  Music2,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'

// ─── Categories ───────────────────────────────────────────────────────────────

interface Category {
  id: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  description: string
}

const CATEGORIES: Category[] = [
  { id: 'Economics',     icon: TrendingUp,   color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      description: 'Markets, policy, fiscal & monetary' },
  { id: 'Politics',      icon: Landmark,     color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  description: 'Governance, elections, civic rights' },
  { id: 'Technology',    icon: Cpu,          color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       description: 'AI, software, digital society' },
  { id: 'Science',       icon: FlaskConical, color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      description: 'Research, evidence, discovery' },
  { id: 'Law',           icon: Scale,        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         description: 'Legislation, justice, legal systems' },
  { id: 'Education',     icon: GraduationCap,color: 'text-for-300',      bg: 'bg-for-300/10',      border: 'border-for-300/30',      description: 'Schools, learning, skills' },
  { id: 'Health',        icon: Heart,        color: 'text-against-300',  bg: 'bg-against-300/10',  border: 'border-against-300/30',  description: 'Medicine, public health, wellness' },
  { id: 'Environment',   icon: Leaf,         color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      description: 'Climate, ecology, sustainability' },
  { id: 'Culture',       icon: Music2,       color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       description: 'Arts, society, identity, media' },
  { id: 'International', icon: TrendingUp,   color: 'text-for-400',      bg: 'bg-for-400/10',      border: 'border-for-400/30',      description: 'Global affairs, diplomacy, geopolitics' },
]

// ─── Date presets ─────────────────────────────────────────────────────────────

interface DatePreset {
  label: string
  getValue: () => string
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getPresets(): DatePreset[] {
  const now = new Date()

  const tomorrow2pm = new Date(now)
  tomorrow2pm.setDate(tomorrow2pm.getDate() + 1)
  tomorrow2pm.setHours(14, 0, 0, 0)

  const nextSaturday3pm = new Date(now)
  const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7
  nextSaturday3pm.setDate(now.getDate() + daysUntilSat)
  nextSaturday3pm.setHours(15, 0, 0, 0)

  const nextMonday10am = new Date(now)
  const daysUntilMon = (1 - now.getDay() + 7) % 7 || 7
  nextMonday10am.setDate(now.getDate() + daysUntilMon)
  nextMonday10am.setHours(10, 0, 0, 0)

  const twoWeeks = new Date(now)
  twoWeeks.setDate(twoWeeks.getDate() + 14)
  twoWeeks.setHours(18, 0, 0, 0)

  return [
    { label: 'Tomorrow 2pm', getValue: () => toLocalDatetimeValue(tomorrow2pm) },
    { label: 'Saturday 3pm', getValue: () => toLocalDatetimeValue(nextSaturday3pm) },
    { label: 'Next Monday 10am', getValue: () => toLocalDatetimeValue(nextMonday10am) },
    { label: 'In 2 weeks', getValue: () => toLocalDatetimeValue(twoWeeks) },
  ]
}

// ─── Hosting tips ─────────────────────────────────────────────────────────────

const TIPS = [
  { icon: Clock,        text: 'Schedule at least 48 hours out so citizens can RSVP and prepare questions.' },
  { icon: MessageSquare,text: 'A clear, specific title draws more RSVPs. "AI Ethics Expert" beats "Tech Talk".' },
  { icon: Users,        text: 'Mention your credentials in the description — it builds community trust.' },
  { icon: Zap,          text: 'Sessions run best at 45–90 minutes. Quality over quantity.' },
]

// ─── Profile helper ────────────────────────────────────────────────────────────

interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HostAMAPage() {
  const router = useRouter()

  // Auth state
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // Submission state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const descRef = useRef<HTMLTextAreaElement>(null)
  const categoryPickerRef = useRef<HTMLDivElement>(null)

  // Load auth user
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?returnUrl=/ama/host')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .eq('id', user.id)
        .single()
      setProfile(data)
      setAuthLoading(false)
    }
    loadProfile()
  }, [router])

  // Close category picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
        setShowCategoryPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategory)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !scheduledAt) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/ama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category: selectedCategory || undefined,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      })
      const data = await res.json() as { session?: { id: string }; error?: string }
      if (!res.ok || !data.session) throw new Error(data.error ?? 'Failed to create session')

      setSuccess(true)
      setTimeout(() => {
        router.push(`/ama/${data.session!.id}`)
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [title, description, selectedCategory, scheduledAt, router])

  // Compute whether form is valid
  const titleValid = title.trim().length >= 5
  const dateValid = scheduledAt !== '' && new Date(scheduledAt) > new Date()
  const canSubmit = titleValid && dateValid && !saving && !success

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex flex-col h-screen bg-surface-50">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-surface-600" />
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 space-y-8">
        {/* Back + header */}
        <div>
          <Link
            href="/ama/my"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My AMA Sessions
          </Link>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-purple/10 border border-purple/30 flex items-center justify-center">
              <Mic className="h-6 w-6 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">Host an AMA</h1>
              <p className="text-sm text-surface-500 font-mono mt-0.5">
                Schedule a live Ask Me Anything session and share your expertise with the Lobby.
              </p>
            </div>
          </div>
        </div>

        {/* Hosting tips */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest">Hosting tips</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TIPS.map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Icon className="h-3.5 w-3.5 text-purple flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-surface-500 font-mono leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="ama-title" className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
              Session Title <span className="text-against-400">*</span>
            </label>
            <div className="relative">
              <input
                id="ama-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                placeholder="e.g. Behavioral Economics AMA — Why We Make Bad Decisions"
                maxLength={120}
                required
                aria-describedby="ama-title-hint"
                className={cn(
                  'w-full bg-surface-100 border rounded-xl px-4 py-3 text-sm text-white placeholder-surface-600',
                  'font-mono focus:outline-none transition-colors',
                  titleValid
                    ? 'border-for-600/40 focus:border-for-500/60'
                    : 'border-surface-300 focus:border-surface-400',
                )}
              />
              <span
                className={cn(
                  'absolute bottom-3 right-3.5 text-[10px] font-mono tabular-nums pointer-events-none',
                  title.length > 100 ? 'text-against-400' : 'text-surface-600',
                )}
              >
                {title.length}/120
              </span>
            </div>
            <p id="ama-title-hint" className="text-[11px] font-mono text-surface-600">
              Keep it specific. What expertise are you bringing and what will you cover?
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="ama-description" className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
              Description
              <span className="text-surface-600 normal-case tracking-normal ml-2 font-normal">optional</span>
            </label>
            <div className="relative">
              <textarea
                id="ama-description"
                ref={descRef}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 600))}
                placeholder="Share your background, what topics you'll cover, and what makes you qualified to answer…"
                rows={4}
                maxLength={600}
                aria-describedby="ama-desc-hint"
                className={cn(
                  'w-full bg-surface-100 border border-surface-300 rounded-xl px-4 py-3',
                  'text-sm text-white placeholder-surface-600 font-mono resize-none',
                  'focus:outline-none focus:border-surface-400 transition-colors',
                )}
              />
              <span
                className={cn(
                  'absolute bottom-3 right-3.5 text-[10px] font-mono tabular-nums pointer-events-none',
                  description.length > 540 ? 'text-against-400' : 'text-surface-600',
                )}
              >
                {description.length}/600
              </span>
            </div>
            <p id="ama-desc-hint" className="text-[11px] font-mono text-surface-600">
              Describe your credentials and what questions you are best positioned to answer.
            </p>
          </div>

          {/* Category picker */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
              Category
              <span className="text-surface-600 normal-case tracking-normal ml-2 font-normal">optional</span>
            </label>
            <div ref={categoryPickerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryPicker((v) => !v)}
                aria-expanded={showCategoryPicker}
                aria-haspopup="listbox"
                className={cn(
                  'w-full flex items-center gap-3 bg-surface-100 border rounded-xl px-4 py-3',
                  'text-sm font-mono transition-colors focus:outline-none',
                  showCategoryPicker
                    ? 'border-surface-400'
                    : 'border-surface-300 hover:border-surface-400',
                )}
              >
                {selectedCat ? (
                  <>
                    <selectedCat.icon className={cn('h-4 w-4 flex-shrink-0', selectedCat.color)} aria-hidden="true" />
                    <span className="flex-1 text-left text-white">{selectedCat.id}</span>
                    <span className="text-surface-500 text-xs">{selectedCat.description}</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-surface-600 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left text-surface-600">Select a category</span>
                  </>
                )}
                <ChevronDown className={cn('h-4 w-4 text-surface-600 transition-transform flex-shrink-0', showCategoryPicker && 'rotate-180')} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {showCategoryPicker && (
                  <motion.ul
                    role="listbox"
                    aria-label="Select category"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-surface-100 border border-surface-300 rounded-xl overflow-hidden shadow-xl"
                  >
                    {/* None option */}
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedCategory === ''}
                        onClick={() => { setSelectedCategory(''); setShowCategoryPicker(false) }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors text-left',
                          selectedCategory === '' ? 'bg-surface-200 text-white' : 'text-surface-500 hover:bg-surface-200/60 hover:text-white',
                        )}
                      >
                        <Mic className="h-4 w-4 flex-shrink-0 text-surface-600" aria-hidden="true" />
                        <span className="flex-1">Any / General</span>
                        {selectedCategory === '' && <Check className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />}
                      </button>
                    </li>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon
                      const isSelected = selectedCategory === cat.id
                      return (
                        <li key={cat.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => { setSelectedCategory(cat.id); setShowCategoryPicker(false) }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-sm font-mono transition-colors text-left',
                              isSelected ? 'bg-surface-200 text-white' : 'text-surface-500 hover:bg-surface-200/60 hover:text-white',
                            )}
                          >
                            <Icon className={cn('h-4 w-4 flex-shrink-0', cat.color)} aria-hidden="true" />
                            <span className="flex-1 text-white">{cat.id}</span>
                            <span className="text-[11px] text-surface-500">{cat.description}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />}
                          </button>
                        </li>
                      )
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Date / time */}
          <div className="space-y-2">
            <label htmlFor="ama-datetime" className="block text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
              Scheduled Date & Time <span className="text-against-400">*</span>
            </label>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 mb-2">
              {getPresets().map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setScheduledAt(preset.getValue())}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors',
                    scheduledAt === preset.getValue()
                      ? 'bg-purple/20 border-purple/50 text-purple'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                  )}
                >
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {preset.label}
                </button>
              ))}
            </div>

            <input
              id="ama-datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              min={toLocalDatetimeValue(new Date(Date.now() + 60_000))}
              aria-describedby="ama-datetime-hint"
              className={cn(
                'w-full bg-surface-100 border rounded-xl px-4 py-3 text-sm font-mono',
                'focus:outline-none transition-colors text-white',
                '[color-scheme:dark]',
                dateValid
                  ? 'border-for-600/40 focus:border-for-500/60'
                  : 'border-surface-300 focus:border-surface-400',
              )}
            />
            <p id="ama-datetime-hint" className="text-[11px] font-mono text-surface-600">
              All times are in your local timezone. Schedule at least 48 hours out for best reach.
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-against-500/40 bg-against-500/10 px-4 py-3 text-sm font-mono text-against-300"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-mono font-semibold',
                'transition-colors',
                canSubmit
                  ? 'bg-purple hover:bg-purple/90 text-white'
                  : 'bg-surface-200 border border-surface-300 text-surface-500 cursor-not-allowed',
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling…
                </>
              ) : success ? (
                <>
                  <Check className="h-4 w-4" />
                  Session created!
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Schedule AMA Session
                </>
              )}
            </button>
            <Link
              href="/ama/my"
              className="px-5 py-3.5 rounded-xl border border-surface-300 text-surface-500 text-sm font-mono hover:border-surface-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Preview card */}
        {(title.trim() || selectedCategory) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-purple" aria-hidden="true" />
              Preview
            </p>
            <div className="rounded-2xl bg-surface-100 border border-purple/20 p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                {profile && (
                  <Avatar
                    username={profile.username}
                    avatarUrl={profile.avatar_url}
                    displayName={profile.display_name}
                    size="md"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono font-semibold text-white">
                      {profile?.display_name ?? profile?.username ?? 'You'}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest bg-surface-200 border border-surface-300 px-1.5 py-0.5 rounded">
                      {profile?.role ?? 'host'}
                    </span>
                  </div>
                  {selectedCat && (
                    <span className={cn('text-[11px] font-mono font-semibold', selectedCat.color)}>
                      {selectedCat.id}
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-purple/10 border border-purple/30 text-[10px] font-mono font-semibold text-purple uppercase tracking-widest">
                  Upcoming
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="font-mono text-sm font-bold text-white leading-snug">
                  {title.trim() || 'Your AMA Title'}
                </p>
                {description.trim() && (
                  <p className="text-xs text-surface-500 font-mono mt-1 leading-relaxed line-clamp-2">
                    {description.trim()}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-surface-300">
                <div className="flex items-center gap-1.5 text-xs text-surface-500 font-mono">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {scheduledAt
                    ? new Date(scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Date TBD'}
                </div>
                <div className="flex items-center gap-3 text-xs text-surface-600 font-mono">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" />
                    0
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    0 RSVPs
                  </span>
                </div>
              </div>
            </div>

            {/* CTA hint */}
            <p className="text-[11px] font-mono text-surface-600 text-center">
              This is how your session will appear on the{' '}
              <Link href="/ama" className="text-purple hover:underline">AMA hub</Link>{' '}
              and in the{' '}
              <Link href="/ama/schedule" className="text-purple hover:underline">schedule</Link>.
            </p>
          </motion.div>
        )}

        {/* What happens next */}
        <div className="rounded-xl border border-surface-300 bg-surface-100/60 p-5 space-y-3">
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest">What happens after you schedule</p>
          <div className="space-y-2.5">
            {[
              { step: '1', text: 'Your session appears on the AMA Hub and Schedule with an RSVP button.' },
              { step: '2', text: 'Citizens browse your session and RSVP — you\'ll see the count rise.' },
              { step: '3', text: 'On the day, click "Start Session" from your session page to go live.' },
              { step: '4', text: 'Community members submit and upvote questions in real time.' },
              { step: '5', text: 'Click "End Session" when done. Top answers are archived in /ama/highlights.' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-purple/10 border border-purple/30 flex items-center justify-center text-[10px] font-mono font-bold text-purple">
                  {step}
                </span>
                <p className="text-xs text-surface-500 font-mono leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Need inspiration? */}
        <div className="text-center space-y-2 pb-4">
          <p className="text-xs text-surface-500 font-mono">Not sure what to talk about?</p>
          <Link
            href="/ama/request"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Browse what citizens want to ask
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
