'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  Calendar,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Mic,
  Music2,
  Radio,
  Scale,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AMAHost } from '@/app/api/ama/route'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpertWithStats {
  host: AMAHost
  totalSessions: number
  endedSessions: number
  upcomingSessions: number
  totalAnswers: number
  totalQuestions: number
  totalRsvps: number
  categories: string[]
  lastSessionAt: string | null
  nextSessionAt: string | null
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}> = {
  Economics:     { icon: TrendingUp,  color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Politics:      { icon: Landmark,    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Technology:    { icon: Cpu,         color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  Science:       { icon: FlaskConical,color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Law:           { icon: Scale,       color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Education:     { icon: GraduationCap,color:'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Health:        { icon: Heart,       color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  Environment:   { icon: Leaf,        color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Culture:       { icon: Music2,      color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  International: { icon: Zap,         color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG)

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] ?? {
    icon: Mic,
    color: 'text-surface-400',
    bg: 'bg-surface-400/10',
    border: 'border-surface-400/20',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function roleLabel(role: string): string {
  if (role === 'expert') return 'Expert'
  if (role === 'moderator') return 'Moderator'
  if (role === 'elder') return 'Elder'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// ─── Expert Card ──────────────────────────────────────────────────────────────

function ExpertCard({ expert }: { expert: ExpertWithStats }) {
  const { host, endedSessions, upcomingSessions, totalAnswers, totalRsvps, categories, nextSessionAt } = expert
  const displayName = host.display_name ?? host.username
  const primaryCategory = categories[0]
  const catConfig = primaryCategory ? getCategoryConfig(primaryCategory) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'relative group bg-surface-100 border border-surface-300 rounded-xl overflow-hidden',
        'hover:border-surface-400 hover:bg-surface-150 transition-colors',
      )}
    >
      <Link href={`/profile/${host.username}`} className="block p-4">
        {/* Live / Upcoming badge */}
        {upcomingSessions > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple/15 border border-purple/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple" />
            </span>
            <span className="text-[10px] font-mono font-semibold text-purple">
              {upcomingSessions === 1 ? 'Upcoming' : `${upcomingSessions} upcoming`}
            </span>
          </div>
        )}

        {/* Avatar + Name */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <Avatar
              src={host.avatar_url}
              fallback={displayName}
              size="lg"
            />
            {catConfig && (
              <div className={cn(
                'absolute -bottom-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full border-2 border-surface-100',
                catConfig.bg,
              )}>
                <catConfig.icon className={cn('h-2.5 w-2.5', catConfig.color)} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-mono font-semibold text-sm text-white truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[11px] font-mono text-surface-500 truncate">@{host.username}</p>
            {host.role && host.role !== 'person' && (
              <span className={cn(
                'inline-flex items-center mt-1 px-1.5 py-0 rounded text-[10px] font-mono font-semibold',
                'bg-gold/10 text-gold border border-gold/20',
              )}>
                {roleLabel(host.role)}
              </span>
            )}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {categories.slice(0, 3).map((cat) => {
              const cfg = getCategoryConfig(cat)
              return (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium border',
                    cfg.bg, cfg.color, cfg.border,
                  )}
                >
                  <cfg.icon className="h-2.5 w-2.5" />
                  {cat}
                </span>
              )
            })}
            {categories.length > 3 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono text-surface-500 bg-surface-300 border border-surface-400">
                +{categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-300/50">
          <div className="text-center">
            <p className="text-sm font-mono font-bold text-white">{endedSessions}</p>
            <p className="text-[10px] font-mono text-surface-500 leading-tight">sessions</p>
          </div>
          <div className="text-center border-x border-surface-300/50">
            <p className="text-sm font-mono font-bold text-white">{totalAnswers}</p>
            <p className="text-[10px] font-mono text-surface-500 leading-tight">answers</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-mono font-bold text-white">{totalRsvps}</p>
            <p className="text-[10px] font-mono text-surface-500 leading-tight">attendees</p>
          </div>
        </div>

        {/* Next session */}
        {nextSessionAt && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-surface-300/50">
            <Calendar className="h-3 w-3 text-purple flex-shrink-0" />
            <span className="text-[11px] font-mono text-purple">
              Next: {formatDate(nextSessionAt)}
            </span>
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Main grid component ──────────────────────────────────────────────────────

interface AMAExpertsGridProps {
  experts: ExpertWithStats[]
}

export function AMAExpertsGrid({ experts }: AMAExpertsGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'sessions' | 'answers' | 'attendees'>('sessions')

  // Derive categories present in data
  const presentCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const e of experts) {
      for (const c of e.categories) cats.add(c)
    }
    return ALL_CATEGORIES.filter((c) => cats.has(c))
  }, [experts])

  const filtered = useMemo(() => {
    const list = selectedCategory
      ? experts.filter((e) => e.categories.includes(selectedCategory))
      : experts

    return [...list].sort((a, b) => {
      if (sortBy === 'answers') return b.totalAnswers - a.totalAnswers
      if (sortBy === 'attendees') return b.totalRsvps - a.totalRsvps
      return b.endedSessions - a.endedSessions
    })
  }, [experts, selectedCategory, sortBy])

  const upcomingCount = experts.filter((e) => e.upcomingSessions > 0).length

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Expert Hosts', value: experts.length, icon: Users, color: 'text-purple' },
          { label: 'With Upcoming', value: upcomingCount, icon: Radio, color: 'text-for-400' },
          { label: 'Answers Given', value: experts.reduce((s, e) => s + e.totalAnswers, 0), icon: MessageSquare, color: 'text-gold' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center"
          >
            <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
            <p className="text-lg font-mono font-bold text-white">{value.toLocaleString()}</p>
            <p className="text-[10px] font-mono text-surface-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">Filter:</span>
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors',
            selectedCategory === null
              ? 'bg-surface-300 text-white'
              : 'text-surface-400 hover:text-white hover:bg-surface-300',
          )}
        >
          All
        </button>
        {presentCategories.map((cat) => {
          const cfg = getCategoryConfig(cat)
          const isActive = selectedCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(isActive ? null : cat)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors',
                isActive
                  ? cn(cfg.bg, cfg.color, cfg.border)
                  : 'text-surface-400 border-surface-400/30 hover:text-white hover:bg-surface-300',
              )}
            >
              <cfg.icon className="h-2.5 w-2.5" />
              {cat}
            </button>
          )
        })}
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">Sort:</span>
        {(['sessions', 'answers', 'attendees'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold capitalize transition-colors',
              sortBy === s
                ? 'bg-surface-300 text-white'
                : 'text-surface-400 hover:text-white hover:bg-surface-300',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-surface-400" />}
          title="No experts found"
          description={selectedCategory ? `No experts have hosted ${selectedCategory} sessions yet.` : 'No AMA hosts yet.'}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((expert) => (
              <ExpertCard key={expert.host.id} expert={expert} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Become a host CTA */}
      <div className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl',
        'bg-purple/5 border border-purple/20',
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
            <Award className="h-4 w-4 text-purple" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-white">Want to host an AMA?</p>
            <p className="text-xs font-mono text-surface-500">Share your expertise with the community</p>
          </div>
        </div>
        <Link
          href="/ama/request"
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-lg text-xs font-mono font-semibold',
            'bg-purple/20 border border-purple/30 text-purple hover:bg-purple/30 transition-colors',
          )}
        >
          Request an AMA
        </Link>
      </div>
    </div>
  )
}
