'use client'

/**
 * /law/[id]/context — Law Context Brief
 *
 * A single-page background brief for any established law:
 *  – The law's community wiki annotation
 *  – Original topic description (what proposers set out to debate)
 *  – Pinned citations / sources from the founding debate
 *  – Top FOR and AGAINST arguments (what carried the vote)
 *
 * Distinct from:
 *   /law/[id]/wiki     — editable collaborative wiki
 *   /law/[id]/brief    — AI-generated argument summary
 *   /law/[id]/evidence — full argument evidence panel
 *   /law/[id]/timeline — chronological history of events
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  Link2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawContextResponse, ContextArgument } from '@/app/api/laws/[id]/context/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Mini argument card ───────────────────────────────────────────────────────

function ArgCard({ arg }: { arg: ContextArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-colors group',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/10'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/10'
      )}
    >
      <div className={cn(
        'flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center',
        isFor ? 'bg-for-500/20' : 'bg-against-500/20'
      )}>
        {isFor
          ? <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
          : <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-600 leading-relaxed line-clamp-3 group-hover:text-surface-500 transition-colors">
          {arg.content}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {arg.author_username && (
            <span className="text-[10px] text-surface-600">@{arg.author_username}</span>
          )}
          {arg.ai_grade && (
            <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
              Grade {arg.ai_grade}
            </span>
          )}
          {arg.upvotes > 0 && (
            <span className="text-[10px] text-surface-500">+{arg.upvotes}</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      <div className={cn('flex items-center gap-2.5 px-5 py-3 border-b border-surface-300/40', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawContextPage() {
  const params = useParams<{ id: string }>()
  const lawId = params.id

  const [data, setData] = useState<LawContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/context`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load context')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const law = data?.law
  const topic = data?.topic
  const sources = data?.sources ?? []
  const forArgs = data?.top_for_args ?? []
  const againstArgs = data?.top_against_args ?? []
  const forPct = law ? Math.round(law.blue_pct) : 0
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Law
        </Link>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BookOpen className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Context Brief</h1>
              <p className="text-xs text-surface-500">Background, sources, and founding arguments</p>
            </div>
          </div>

          {law && (
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/60 space-y-3">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                <p className="text-sm text-white font-medium leading-snug">{law.statement}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {law.category && <Badge variant="outline" className="text-[10px]">{law.category}</Badge>}
                {law.scope && <Badge variant="outline" className="text-[10px] text-surface-500">{law.scope}</Badge>}
                <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
                <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
                <span className="text-[10px] text-surface-500 font-mono">
                  {law.total_votes.toLocaleString()} votes
                </span>
                <span className="text-[10px] text-surface-500">
                  Established {fmtDate(law.established_at)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm text-surface-500">
            {loading ? 'Loading…' : 'Context brief'}
          </span>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={BookOpen}
            iconColor="text-surface-500"
            title="Could not load context"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-5">

            {/* Community Wiki */}
            {law?.wiki_content && (
              <Section icon={FileText} iconColor="text-for-400" iconBg="bg-for-500/5" title="Community Wiki">
                <div className="prose-sm text-surface-600 leading-relaxed whitespace-pre-wrap break-words">
                  {law.wiki_content}
                </div>
                {law.wiki_updated_at && (
                  <p className="text-[10px] text-surface-600 mt-3">
                    Last updated {fmtDate(law.wiki_updated_at)}
                    {' · '}
                    <Link href={`/law/${lawId}/wiki`} className="text-for-400 hover:text-for-300 transition-colors">
                      Edit Wiki
                    </Link>
                  </p>
                )}
              </Section>
            )}

            {/* Topic description */}
            {topic?.description && (
              <Section icon={MessageSquare} iconColor="text-purple" iconBg="bg-purple/5" title="Original Proposal">
                <div className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap break-words">
                  {topic.description}
                </div>
                {(topic.author_username || topic.created_at) && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-200/40">
                    {topic.author_username && (
                      <Link
                        href={`/profile/${topic.author_username}`}
                        className="flex items-center gap-1.5 text-[10px] text-surface-500 hover:text-surface-700 transition-colors"
                      >
                        <Avatar
                          src={topic.author_avatar_url ?? undefined}
                          fallback={topic.author_display_name || topic.author_username}
                          size="xs"
                        />
                        <span>Proposed by @{topic.author_username}</span>
                      </Link>
                    )}
                    {topic.created_at && (
                      <span className="text-[10px] text-surface-600 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {fmtDate(topic.created_at)}
                      </span>
                    )}
                  </div>
                )}
              </Section>
            )}

            {/* Full statement */}
            {law?.full_statement && law.full_statement !== law.statement && (
              <Section icon={Gavel} iconColor="text-emerald" iconBg="bg-emerald/5" title="Full Statement">
                <p className="text-sm text-surface-600 leading-relaxed">{law.full_statement}</p>
              </Section>
            )}

            {/* Body markdown */}
            {law?.body_markdown && (
              <Section icon={FileText} iconColor="text-gold" iconBg="bg-gold/5" title="Law Body">
                <div className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap break-words">
                  {law.body_markdown}
                </div>
              </Section>
            )}

            {/* Sources */}
            {sources.length > 0 && (
              <Section icon={Link2} iconColor="text-for-300" iconBg="bg-for-400/5" title="Cited Sources">
                <div className="space-y-2">
                  {sources.map((src) => (
                    <a
                      key={src.id}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
                    >
                      <Globe className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5 group-hover:text-for-400 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white group-hover:text-for-300 transition-colors truncate">
                          {src.title}
                        </p>
                        {src.description && (
                          <p className="text-[10px] text-surface-500 mt-0.5 line-clamp-2">{src.description}</p>
                        )}
                        {src.domain && (
                          <p className="text-[10px] text-surface-600 mt-0.5">{src.domain}</p>
                        )}
                      </div>
                      <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {/* Top arguments */}
            {(forArgs.length > 0 || againstArgs.length > 0) && (
              <Section icon={MessageSquare} iconColor="text-surface-500" iconBg="bg-surface-200/30" title="Arguments that Carried the Vote">
                <div className="grid gap-4 sm:grid-cols-2">
                  {forArgs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                        <span className="text-xs font-semibold text-for-400">Top FOR</span>
                      </div>
                      <div className="space-y-2">
                        {forArgs.map((arg) => <ArgCard key={arg.id} arg={arg} />)}
                      </div>
                    </div>
                  )}
                  {againstArgs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                        <span className="text-xs font-semibold text-against-400">Top AGAINST</span>
                      </div>
                      <div className="space-y-2">
                        {againstArgs.map((arg) => <ArgCard key={arg.id} arg={arg} />)}
                      </div>
                    </div>
                  )}
                </div>
                <Link
                  href={`/topic/${law?.topic_id}/arguments`}
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                >
                  View all arguments
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Section>
            )}

            {/* Empty case */}
            {!law?.wiki_content && !topic?.description && sources.length === 0 && forArgs.length === 0 && (
              <EmptyState
                icon={BookOpen}
                iconColor="text-surface-500"
                title="No context added yet"
                description="Be the first to add background context by editing the law wiki."
                action={{ label: 'Edit Wiki', href: `/law/${lawId}/wiki` }}
              />
            )}

            {/* Related links */}
            <div className="grid gap-2 sm:grid-cols-3 pt-2">
              {[
                { label: 'Argument Themes', href: `/law/${lawId}/themes`, desc: 'Civic reasoning' },
                { label: 'Full Discussion', href: `/topic/${data.law.topic_id}`, desc: 'Original debate' },
                { label: 'Law Timeline', href: `/law/${lawId}/timeline`, desc: 'History' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-white group-hover:text-for-300 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[10px] text-surface-500">{link.desc}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
