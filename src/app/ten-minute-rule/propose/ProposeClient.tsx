'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  ScrollText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

export function ProposeClient() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Politics')
  const [speech, setSpeech] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const speechLen = speech.trim().length
  const titleLen = title.trim().length
  const canSubmit = titleLen >= 10 && speechLen >= 100 && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ten-minute-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), category, proposal_speech: speech.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Submission failed.')
      setDone(true)
      setTimeout(() => router.push(`/ten-minute-rule/${data.id}`), 1500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-6"
        >
          <CheckCircle2 className="h-12 w-12 text-emerald mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Proposal Submitted</h2>
          <p className="text-surface-400 text-sm">The House has received your proposal. Redirecting…</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Back */}
        <Link
          href="/ten-minute-rule"
          className="inline-flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Ten Minute Rule
        </Link>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-5 w-5 text-for-400" />
          <h1 className="text-xl font-bold text-white">Propose a Bill</h1>
        </div>
        <p className="text-surface-400 text-sm mb-6 leading-relaxed">
          Write your Ten Minute Rule speech. Make the case for why your bill should be introduced into the
          chamber. Another citizen will have the opportunity to respond — then the House votes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Bill Title
              <span className="text-surface-500 font-normal ml-2 text-xs">({titleLen}/120)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Climate Emergency Declaration Bill"
              className={cn(
                'w-full bg-surface-200 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500 transition-colors',
                titleLen > 0 && titleLen < 10 ? 'border-against-500' : 'border-surface-300',
              )}
            />
            {titleLen > 0 && titleLen < 10 && (
              <p className="text-against-400 text-xs mt-1">Title must be at least 10 characters.</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Policy Area</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    category === cat
                      ? 'bg-for-600 border-for-500 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Speech */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Your Proposal Speech
              <span className="text-surface-500 font-normal ml-2 text-xs">
                ({speechLen}/2000 — min 100)
              </span>
            </label>
            <textarea
              value={speech}
              onChange={(e) => setSpeech(e.target.value)}
              maxLength={2000}
              rows={10}
              placeholder={
                'Mr Deputy Speaker,\n\n' +
                'I rise to seek leave to introduce a bill to...\n\n' +
                'The purpose of this bill is to...\n\n' +
                'I commend this bill to the House.'
              }
              className={cn(
                'w-full bg-surface-200 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500 transition-colors resize-none font-mono leading-relaxed',
                speechLen > 0 && speechLen < 100 ? 'border-against-500' : 'border-surface-300',
              )}
            />
            {speechLen > 0 && speechLen < 100 && (
              <p className="text-against-400 text-xs mt-1">Speech must be at least 100 characters.</p>
            )}
          </div>

          {/* Guidance */}
          <div className="bg-surface-200 border border-surface-300 rounded-lg p-4 text-xs text-surface-400 space-y-1.5">
            <p className="flex items-start gap-2">
              <ScrollText className="h-3.5 w-3.5 text-for-400 shrink-0 mt-0.5" />
              <span>Your speech should explain WHAT the bill does and WHY it is needed.</span>
            </p>
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
              <span>Once submitted, you cannot edit the speech. Another citizen may step up to oppose it.</span>
            </p>
          </div>

          {error && (
            <div className="bg-against-950 border border-against-500/40 rounded-lg px-4 py-3 text-against-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Submit Proposal
                </>
              )}
            </Button>
            <Link href="/ten-minute-rule">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </form>
      </main>

      <BottomNav />
    </div>
  )
}
