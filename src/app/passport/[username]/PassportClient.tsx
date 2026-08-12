'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  Loader2,
  MessageSquare,
  QrCode,
  Scale,
  Share2,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type { PassportData, PassportCategory } from '@/app/api/passport/[username]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'CITIZEN',
  debator: 'DEBATOR',
  troll_catcher: 'TROLL CATCHER',
  elder: 'ELDER',
  lawmaker: 'LAWMAKER',
  senator: 'SENATOR',
}

const ROLE_CLASS: Record<string, string> = {
  person: 'text-surface-500 border-surface-400',
  debator: 'text-for-400 border-for-500/40',
  troll_catcher: 'text-emerald border-emerald/40',
  elder: 'text-gold border-gold/40',
  lawmaker: 'text-gold border-gold/50',
  senator: 'text-purple border-purple/40',
}

const CAT_COLORS: Record<string, string> = {
  Economics: 'text-gold bg-gold/10 border-gold/30',
  Politics: 'text-for-400 bg-for-500/10 border-for-500/30',
  Technology: 'text-purple bg-purple/10 border-purple/30',
  Science: 'text-emerald bg-emerald/10 border-emerald/30',
  Ethics: 'text-against-300 bg-against-500/10 border-against-500/30',
  Philosophy: 'text-for-300 bg-for-400/10 border-for-400/30',
  Culture: 'text-gold bg-gold/10 border-gold/30',
  Health: 'text-emerald bg-emerald/10 border-emerald/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education: 'text-purple bg-purple/10 border-purple/30',
  Uncategorized: 'text-surface-500 bg-surface-300/20 border-surface-400',
}

function catClass(name: string): string {
  return CAT_COLORS[name] ?? 'text-surface-500 bg-surface-300/20 border-surface-400'
}

function issueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function forPct(data: PassportData): number {
  if (!data.total_votes) return 50
  return Math.round((data.blue_vote_count / data.total_votes) * 100)
}

// ─── QR placeholder (drawn via canvas) ────────────────────────────────────────

function QRPlaceholder({ url, size = 80 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cells = 21
    const cellSize = size / cells
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, size, size)

    // Deterministic pattern based on URL characters
    const seed = url.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    ctx.fillStyle = '#e5e7eb'

    // Fixed corners (finder patterns)
    const drawFinder = (ox: number, oy: number) => {
      ctx.fillRect(ox * cellSize, oy * cellSize, 7 * cellSize, 7 * cellSize)
      ctx.fillStyle = '#0f1117'
      ctx.fillRect((ox + 1) * cellSize, (oy + 1) * cellSize, 5 * cellSize, 5 * cellSize)
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect((ox + 2) * cellSize, (oy + 2) * cellSize, 3 * cellSize, 3 * cellSize)
    }

    drawFinder(0, 0)
    drawFinder(cells - 7, 0)
    drawFinder(0, cells - 7)

    // Data cells
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const isFinderZone =
          (r < 8 && c < 8) ||
          (r < 8 && c >= cells - 8) ||
          (r >= cells - 8 && c < 8)
        if (isFinderZone) continue
        const hash = (seed * (r * cells + c + 1) * 2654435761) >>> 0
        if (hash % 3 !== 0) {
          ctx.fillStyle = '#e5e7eb'
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
        }
      }
    }
  }, [url, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-sm opacity-80"
    />
  )
}

// ─── Category stamp ────────────────────────────────────────────────────────────

function CategoryStamp({ cat }: { cat: PassportCategory }) {
  const Icon = cat.side === 'for' ? ThumbsUp : cat.side === 'against' ? ThumbsDown : Scale
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-semibold tracking-wide', catClass(cat.category))}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      {cat.category}
    </div>
  )
}

// ─── Main passport card ────────────────────────────────────────────────────────

function PassportCard({ data, username }: { data: PassportData; username: string }) {
  const archetype = data.civic_archetype && data.civic_archetype in ARCHETYPE_CONFIG
    ? ARCHETYPE_CONFIG[data.civic_archetype as ArchetypeId]
    : null

  const roleLabel = ROLE_LABEL[data.role] ?? data.role.toUpperCase()
  const roleClass = ROLE_CLASS[data.role] ?? ROLE_CLASS.person
  const pct = forPct(data)
  const issued = issueDate(data.created_at)
  const cvUrl = `https://lobby.market/cv/${username}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-sm mx-auto"
    >
      {/* Passport booklet */}
      <div className="relative rounded-2xl overflow-hidden border border-surface-300/50 bg-surface-100 shadow-2xl shadow-black/60">

        {/* Header band */}
        <div className={cn(
          'px-5 py-3 flex items-center justify-between',
          archetype ? archetype.bgColor : 'bg-for-500/10',
          'border-b border-surface-300/30'
        )}>
          <div className="flex items-center gap-2">
            <Globe className={cn('w-4 h-4', archetype ? archetype.color : 'text-for-400')} />
            <span className="font-mono text-xs tracking-widest text-surface-400 uppercase">
              Civic Passport
            </span>
          </div>
          <span className={cn(
            'font-mono text-[10px] tracking-widest px-2 py-0.5 rounded border font-bold',
            roleClass
          )}>
            {roleLabel}
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">

          {/* Identity row */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Avatar
                src={data.avatar_url}
                fallback={data.display_name ?? data.username}
                size="lg"
                className={cn(
                  '!w-20 !h-20 ring-2 ring-offset-2 ring-offset-surface-100',
                  archetype ? `ring-${archetype.color.replace('text-', '')}` : 'ring-for-500/40'
                )}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1 pt-1">
              <p className="font-mono text-[10px] text-surface-500 tracking-widest uppercase">Surname / Prénom</p>
              <h1 className="font-mono text-xl font-black text-white leading-tight truncate">
                {data.display_name ?? data.username}
              </h1>
              <p className="font-mono text-sm text-surface-500">@{data.username}</p>
              {archetype && (
                <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono font-semibold', archetype.bgColor, archetype.color, archetype.borderColor)}>
                  <archetype.icon className="w-3 h-3" />
                  {archetype.name}
                </div>
              )}
            </div>
          </div>

          {/* Machine-readable zone divider */}
          <div className="h-px bg-surface-300/40" />

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Vote className="w-3 h-3 text-surface-500" />
              </div>
              <p className="font-mono text-lg font-bold text-white tabular-nums">
                {data.total_votes.toLocaleString()}
              </p>
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Votes</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <MessageSquare className="w-3 h-3 text-surface-500" />
              </div>
              <p className="font-mono text-lg font-bold text-purple tabular-nums">
                {data.total_arguments.toLocaleString()}
              </p>
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Args</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gavel className="w-3 h-3 text-surface-500" />
              </div>
              <p className="font-mono text-lg font-bold text-gold tabular-nums">
                {data.laws_supported.toLocaleString()}
              </p>
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">Laws</p>
            </div>
          </div>

          {/* FOR/AGAINST bar */}
          <div className="space-y-1.5">
            <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-for-500 rounded-l-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
              <div
                className="h-full bg-against-500 rounded-r-full transition-all duration-700"
                style={{ width: `${100 - pct}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-for-400 flex items-center gap-0.5">
                <ThumbsUp className="w-2.5 h-2.5" /> {pct}% FOR
              </span>
              <span className="text-surface-500">
                {data.clout.toLocaleString()} clout · {data.vote_streak}🔥
              </span>
              <span className="text-against-400 flex items-center gap-0.5">
                {100 - pct}% AGAINST <ThumbsDown className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>

          {/* Category stamps */}
          {data.top_categories.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-widest">Civic Domains</p>
              <div className="flex flex-wrap gap-1.5">
                {data.top_categories.map((cat) => (
                  <CategoryStamp key={cat.category} cat={cat} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom metadata */}
          <div className="h-px bg-surface-300/40" />
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <div>
                  <p className="font-mono text-[9px] text-surface-600 uppercase tracking-widest">Issued</p>
                  <p className="font-mono text-xs text-surface-400">{issued}</p>
                </div>
                <div>
                  <p className="font-mono text-[9px] text-surface-600 uppercase tracking-widest">Passport No.</p>
                  <p className="font-mono text-xs text-surface-400 tracking-wider">{data.passport_number}</p>
                </div>
              </div>
              <p className="font-mono text-[9px] text-surface-600 tracking-widest uppercase">Issued by Lobby Market · lobby.market</p>
            </div>
            <div className="flex-shrink-0">
              <QRPlaceholder url={cvUrl} size={72} />
            </div>
          </div>
        </div>

        {/* Machine-readable bottom strip */}
        <div className="bg-surface-200/50 border-t border-surface-300/30 px-5 py-2">
          <p className="font-mono text-[9px] text-surface-600 tracking-[0.15em] uppercase truncate">
            P&lt;LOBBY{(data.display_name ?? data.username).toUpperCase().replace(/[^A-Z]/g, '<')}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
          </p>
          <p className="font-mono text-[9px] text-surface-600 tracking-[0.1em] truncate">
            {data.passport_number}&lt;LOBBY&lt;{data.username.toUpperCase().padEnd(14, '<')}&lt;{data.total_votes.toString().padStart(6, '0')}&lt;{data.clout.toString().padStart(6, '0')}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-5">
        <Link
          href={`/cv/${username}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-sm font-semibold bg-surface-200 hover:bg-surface-300 text-white border border-surface-300 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Full CV
        </Link>
        <Link
          href={`/profile/${username}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-sm font-semibold bg-for-500/10 hover:bg-for-500/20 text-for-400 border border-for-500/30 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Profile
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PassportClient({ username }: { username: string }) {
  const [data, setData] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/passport/${encodeURIComponent(username)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((json) => { if (json) setData(json as PassportData) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [username])

  const handleShare = async () => {
    const url = `https://lobby.market/passport/${username}`
    if (navigator.share) {
      await navigator.share({ title: `${username}'s Civic Passport`, url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 font-mono text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-for-400" />
            <span className="font-mono text-sm text-surface-400 tracking-wide">Civic Passport</span>
          </div>
          {data && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 font-mono text-sm text-surface-500 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 text-for-400 animate-spin mx-auto" />
              <p className="font-mono text-sm text-surface-500">Issuing passport…</p>
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && !loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-4">
              <QrCode className="w-10 h-10 text-surface-500 mx-auto" />
              <p className="font-mono text-lg text-white">Citizen not found</p>
              <p className="font-mono text-sm text-surface-500">
                @{username} does not have a Lobby Market account.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 font-mono text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go home
              </Link>
            </div>
          </div>
        )}

        {/* Passport */}
        {data && !loading && <PassportCard data={data} username={username} />}
      </main>

      <BottomNav />
    </div>
  )
}
