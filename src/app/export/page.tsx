'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  FileJson,
  Flame,
  Globe,
  Hourglass,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Data categories ─────────────────────────────────────────────────────────

const EXPORT_CATEGORIES = [
  {
    icon: Shield,
    label: 'Profile',
    description: 'Username, display name, bio, role, clout, verification tier, civic archetype',
    color: 'text-for-400',
    bg: 'bg-for-600/10',
    border: 'border-for-600/20',
  },
  {
    icon: Scale,
    label: 'Votes',
    description: 'Every vote you have cast — topic, side (FOR / AGAINST), and timestamp',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
  },
  {
    icon: MessageSquare,
    label: 'Arguments',
    description: 'All arguments you have written, with side, upvote counts, and source links',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
  },
  {
    icon: Award,
    label: 'Achievements',
    description: 'Every badge and achievement earned, with the date it was unlocked',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
  },
  {
    icon: Flame,
    label: 'Debates',
    description: 'Debates you have participated in, including your side and join date',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
  },
  {
    icon: Globe,
    label: 'Coalitions',
    description: 'Coalitions you have joined, your role, and membership date',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
  },
  {
    icon: Hourglass,
    label: 'Predictions',
    description: 'Every prediction made — outcome, confidence, reasoning, and clout earned',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
  },
  {
    icon: BookOpen,
    label: 'Bookmarks',
    description: 'Topics you have saved for later reading',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
  },
  {
    icon: Users,
    label: 'Social Graph',
    description: 'Who you follow and who follows you, with follow dates',
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-300',
  },
] as const

const LAST_EXPORT_KEY = 'lm_last_export'

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfileStats {
  total_votes: number
  total_arguments: number
  clout: number
}

export default function ExportPage() {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [lastExportDate, setLastExportDate] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LAST_EXPORT_KEY)
    if (stored) setLastExportDate(stored)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select('total_votes, total_arguments, clout')
          .eq('id', user.id)
          .maybeSingle()

        if (data) setStats(data as ProfileStats)
      } catch {
        // non-critical
      } finally {
        setLoadingStats(false)
      }
    }
    load()
  }, [])

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    setDownloadError(null)
    setDownloadSuccess(false)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to export your data.')
        throw new Error('Export failed — please try again.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lobby-market-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const now = new Date().toISOString()
      localStorage.setItem(LAST_EXPORT_KEY, now)
      setLastExportDate(now)
      setDownloadSuccess(true)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setDownloading(false)
    }
  }, [])

  function fmtNum(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
    return n.toLocaleString('en-GB')
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 md:py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <Link
            href="/settings"
            aria-label="Back to settings"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white font-mono leading-tight">
              Export My Data
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Download a complete copy of your civic record as JSON
            </p>
          </div>
        </div>

        {/* Stats strip */}
        {(loadingStats || stats) && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
            <p className="text-[10px] text-surface-500 font-mono uppercase tracking-widest mb-3">
              Your export includes
            </p>
            {loadingStats ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Votes', value: fmtNum(stats.total_votes), color: 'text-white' },
                  { label: 'Arguments', value: fmtNum(stats.total_arguments), color: 'text-white' },
                  { label: 'Clout', value: fmtNum(stats.clout), color: 'text-gold' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-surface-200 px-3 py-2.5 text-center">
                    <p className={cn('text-lg font-bold font-mono tabular-nums', color)}>{value}</p>
                    <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Category cards */}
        <div className="space-y-2 mb-6">
          {EXPORT_CATEGORIES.map(({ icon: Icon, label, description, color, bg, border }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4"
            >
              <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 border', bg, border)}>
                <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight">{label}</p>
                <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <CheckCircle2
                className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5"
                aria-label="Included"
              />
            </motion.div>
          ))}
        </div>

        {/* File info row */}
        <div className="flex items-center gap-3 rounded-xl bg-surface-200/60 border border-surface-300 px-4 py-3 mb-5">
          <FileJson className="h-5 w-5 text-for-400 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-mono font-medium truncate">
              lobby-market-export-{today}.json
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              Machine-readable JSON · All data included · Not encrypted
            </p>
          </div>
        </div>

        {/* Last export notice */}
        {lastExportDate && !downloadSuccess && (
          <p className="text-xs text-surface-500 font-mono text-center mb-4">
            Last exported {fmtDate(lastExportDate)}
          </p>
        )}

        {/* Success banner */}
        {downloadSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2.5 rounded-xl bg-emerald/10 border border-emerald/20 px-4 py-3 mb-4"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-emerald font-mono">Export downloaded successfully</p>
          </motion.div>
        )}

        {/* Error banner */}
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2.5 rounded-xl bg-against-500/10 border border-against-500/20 px-4 py-3 mb-4"
          >
            <p className="text-sm text-against-400 font-mono">{downloadError}</p>
          </motion.div>
        )}

        {/* CTA */}
        <Button
          variant="for"
          size="lg"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-2xl font-mono"
          aria-label={downloading ? 'Preparing your export' : 'Download all my civic data as JSON'}
        >
          {downloading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Preparing export…
            </>
          ) : (
            <>
              <Download className="h-5 w-5" aria-hidden="true" />
              Download My Data
            </>
          )}
        </Button>

        {/* Privacy footnote */}
        <p className="text-[11px] text-surface-600 text-center font-mono mt-4 leading-relaxed px-4">
          Your export contains all data linked to your account.
          Store it securely — it is not encrypted.{' '}
          <Link href="/help" className="text-for-400 hover:text-for-300 underline">
            Data portability & privacy
          </Link>
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
