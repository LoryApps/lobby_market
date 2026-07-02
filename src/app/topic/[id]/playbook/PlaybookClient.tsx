'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  Lightbulb,
  MessageSquare,
  Scale,
  Shield,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaybookTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string
}

export interface PlaybookArg {
  id: string
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  source_url: string | null
  created_at: string
}

export interface PlaybookCoalitionStance {
  id: string
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  coalition: {
    id: string
    name: string
    color: string | null
    badge_emoji: string | null
    member_count: number
  } | null
}

interface PlaybookClientProps {
  topic: PlaybookTopic
  blueArgs: PlaybookArg[]
  redArgs: PlaybookArg[]
  coalitionStances: PlaybookCoalitionStance[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald bg-emerald/10 border-emerald/30',
  B: 'text-for-400 bg-for-500/10 border-for-500/30',
  C: 'text-gold bg-gold/10 border-gold/30',
  D: 'text-against-400 bg-against-500/10 border-against-500/30',
  F: 'text-against-600 bg-against-600/10 border-against-600/30',
}

// ─── Persuasion tactics by category ──────────────────────────────────────────

const TACTICS_FOR: Record<string, string[]> = {
  Economics: [
    'Lead with concrete numbers and economic modelling',
    'Appeal to both efficiency (productivity) and equity (fairness)',
    'Show historical precedents from comparable economies',
  ],
  Politics: [
    'Frame in terms of democratic legitimacy and public mandate',
    'Cite polling data and constituency priorities',
    'Connect to constitutional principles and rights',
  ],
  Technology: [
    'Emphasise innovation velocity and competitive advantage',
    'Address safety/ethics concerns proactively',
    'Use analogies from prior successful tech adoption',
  ],
  Science: [
    'Lead with peer-reviewed evidence and expert consensus',
    'Quantify risk with confidence intervals',
    'Rebut uncertainty framing with the precautionary principle',
  ],
  default: [
    'Lead with the strongest empirical evidence you have',
    'Acknowledge the opposition\'s best point, then neutralise it',
    'Close with a concrete, actionable outcome',
  ],
}

const TACTICS_AGAINST: Record<string, string[]> = {
  Economics: [
    'Expose uncosted externalities and fiscal risk',
    'Point to unintended market distortions in similar policies',
    'Challenge the modelling assumptions behind projected benefits',
  ],
  Politics: [
    'Raise accountability and oversight gaps in the proposal',
    'Highlight minority concerns the majority can overlook',
    'Invoke separation-of-powers or procedural concerns',
  ],
  Technology: [
    'Surface privacy risks and surveillance implications',
    'Demand independent safety audits before deployment',
    'Cite comparable policies that stifled innovation elsewhere',
  ],
  Science: [
    'Challenge statistical significance and sample size',
    'Request replication studies before policy action',
    'Distinguish correlation from causation in cited research',
  ],
  default: [
    'Target the weakest assumption in the FOR case',
    'Show unintended consequences with concrete examples',
    'Demand a higher burden of proof before major change',
  ],
}

// ─── Swing-vote insight generator ─────────────────────────────────────────────

function getSwingInsight(forPct: number, _category: string | null, _status: string): string {
  if (forPct >= 75) {
    return 'Strong majority already established. FOR side needs to maintain momentum and prevent late defections. AGAINST side needs a high-impact event to shift the narrative.'
  }
  if (forPct >= 60) {
    return 'FOR side is ahead but the majority is soft. Undecided centrists hold the balance. Focus on pragmatic, evidence-based appeals rather than ideological framing.'
  }
  if (forPct >= 48 && forPct <= 52) {
    return 'Knife-edge contest. Every argument counts. The debate will be won or lost in the quality of the middle-ground arguments. Avoid extreme positions.'
  }
  if (forPct >= 40) {
    return 'AGAINST side holds a slim lead. FOR side needs a compelling reframe. AGAINST side must consolidate without alienating persuadables.'
  }
  return 'AGAINST side has a decisive lead. FOR side needs a bold new argument or evidence to break through. AGAINST side should stay disciplined on core talking points.'
}

// ─── Path to law / path to failure ───────────────────────────────────────────

function getPathToLaw(forPct: number): string {
  const distance = 75 - forPct
  if (distance <= 0) return 'Already at or above the 75% threshold — law is within reach if status advances to voting.'
  if (distance <= 5) return `Only ${distance.toFixed(1)} percentage points from the 75% threshold. Targeted persuasion of moderate AGAINST voters could close this gap.`
  if (distance <= 15) return `${distance.toFixed(1)} points below the 75% threshold. Sustained momentum, coalition-building, and quality arguments are needed over weeks.`
  return `${distance.toFixed(1)} points below the 75% threshold — a significant campaign shift is required. Focus on reframing the core proposition.`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArgumentCard({ arg, side }: { arg: PlaybookArg; side: 'blue' | 'red' }) {
  const isFor = side === 'blue'
  const gradeCls = arg.ai_grade ? (GRADE_COLOR[arg.ai_grade[0]] ?? '') : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
        'transition-colors'
      )}
    >
      <p className="text-sm font-mono text-surface-700 leading-relaxed line-clamp-4">
        &ldquo;{arg.content}&rdquo;
      </p>
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          <span>{arg.upvotes}</span>
        </div>
        {arg.ai_grade && (
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
              gradeCls
            )}
          >
            {arg.ai_grade}
          </span>
        )}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            Source <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </motion.div>
  )
}

function TacticRow({ icon: Icon, text }: { icon: typeof Lightbulb; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-200/40 border border-surface-300/40">
      <Icon className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs font-mono text-surface-600 leading-relaxed">{text}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-mono font-bold text-surface-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlaybookClient({ topic, blueArgs, redArgs, coalitionStances }: PlaybookClientProps) {
  const params = useParams<{ id: string }>()
  const [activeSide, setActiveSide] = useState<'for' | 'against'>('for')

  const forPct = Math.round(topic.blue_pct ?? 50)

  const againstPct = 100 - forPct
  const catColor = topic.category ? (CATEGORY_COLOR[topic.category] ?? 'text-surface-400') : 'text-surface-400'

  const forCoalitions = coalitionStances.filter((c) => c.stance === 'for')
  const againstCoalitions = coalitionStances.filter((c) => c.stance === 'against')

  const isFor = activeSide === 'for'
  const tactics = isFor
    ? (TACTICS_FOR[topic.category ?? 'default'] ?? TACTICS_FOR.default)
    : (TACTICS_AGAINST[topic.category ?? 'default'] ?? TACTICS_AGAINST.default)

  const ownArgs = isFor ? blueArgs : redArgs
  const oppArgs = isFor ? redArgs : blueArgs
  const ownCoalitions = isFor ? forCoalitions : againstCoalitions
  const swingInsight = getSwingInsight(forPct, topic.category, topic.status)
  const pathToLaw = getPathToLaw(forPct)

  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">

        {/* ── Back nav ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/topic/${params.id}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-[11px] font-mono font-bold uppercase tracking-wider', catColor)}>
                {topic.category}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-600 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded">
              {STATUS_LABEL[topic.status] ?? topic.status}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <Swords className="h-3 w-3" />
              <span>Campaign Playbook</span>
            </div>
          </div>

          <h1 className="text-xl font-mono font-bold text-white leading-snug">
            {topic.statement}
          </h1>

          {/* Vote bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-for-400 font-bold">{forPct}% FOR</span>
              <span className="text-surface-500">{(topic.total_votes ?? 0).toLocaleString()} votes</span>
              <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
            </div>
            <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-against-500 to-against-700 transition-all duration-700"
                style={{ width: `${againstPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Side toggle ───────────────────────────────────────────────────── */}
        <div className="flex rounded-xl border border-surface-300 bg-surface-200/40 p-1 mb-8 gap-1">
          <button
            onClick={() => setActiveSide('for')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all',
              activeSide === 'for'
                ? 'bg-for-600 text-white shadow-md'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <ThumbsUp className="h-4 w-4" />
            FOR Playbook
          </button>
          <button
            onClick={() => setActiveSide('against')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all',
              activeSide === 'against'
                ? 'bg-against-600 text-white shadow-md'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <ThumbsDown className="h-4 w-4" />
            AGAINST Playbook
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSide}
            initial={{ opacity: 0, x: isFor ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isFor ? 16 : -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >

            {/* ── Section 1: Mission Brief ─────────────────────────────────── */}
            <section className={cn(
              'rounded-xl border p-5 space-y-3',
              isFor
                ? 'bg-for-500/5 border-for-500/25'
                : 'bg-against-500/5 border-against-500/25'
            )}>
              <div className="flex items-center gap-2">
                <Target className={cn('h-4 w-4', isFor ? 'text-for-400' : 'text-against-400')} />
                <h2 className="text-sm font-mono font-bold text-white">Mission Brief</h2>
              </div>
              <p className="text-sm font-mono text-surface-600 leading-relaxed">
                {isFor
                  ? `You are advocating FOR this proposal. Your goal is to reach 75% support to establish this as law. Currently at ${forPct}% — ${forPct >= 75 ? 'above threshold' : `${(75 - forPct).toFixed(1)} points to go`}.`
                  : `You are opposing this proposal. Your goal is to keep support below 75% and prevent this from becoming law. Currently at ${forPct}% — ${againstPct >= 25 ? 'holding the line' : 'threshold breached — focus on reversal'}.`
                }
              </p>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border',
                forPct >= 75
                  ? (isFor ? 'text-emerald bg-emerald/10 border-emerald/30' : 'text-against-400 bg-against-500/10 border-against-500/30')
                  : (isFor ? 'text-gold bg-gold/10 border-gold/30' : 'text-emerald bg-emerald/10 border-emerald/30')
              )}>
                {isFor
                  ? (forPct >= 75 ? '✓ Threshold Reached' : `${(75 - forPct).toFixed(1)}pts to Law`)
                  : (forPct < 75 ? '✓ Currently Blocking' : `${(forPct - 75).toFixed(1)}pts over — needs reversal`)
                }
              </div>
            </section>

            {/* ── Section 2: Top Arguments ─────────────────────────────────── */}
            <section className="space-y-4">
              <SectionLabel>
                Your {ownArgs.length > 0 ? 'Top' : ''} Arguments ({isFor ? 'FOR' : 'AGAINST'})
              </SectionLabel>

              {ownArgs.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-surface-300 bg-surface-200/30">
                  <MessageSquare className="h-8 w-8 text-surface-600 mx-auto mb-3" />
                  <p className="text-sm font-mono text-surface-500">No {isFor ? 'FOR' : 'AGAINST'} arguments yet.</p>
                  <Link
                    href={`/topic/${params.id}`}
                    className={cn(
                      'inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
                      isFor
                        ? 'bg-for-600 hover:bg-for-500 text-white'
                        : 'bg-against-600 hover:bg-against-500 text-white'
                    )}
                  >
                    Be first to argue {isFor ? 'FOR' : 'AGAINST'}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {ownArgs.slice(0, 4).map((arg) => (
                    <ArgumentCard key={arg.id} arg={arg} side={isFor ? 'blue' : 'red'} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 3: Persuasion Tactics ────────────────────────────── */}
            <section className="space-y-4">
              <SectionLabel>Persuasion Tactics</SectionLabel>
              <div className="space-y-2">
                {tactics.map((tactic, i) => (
                  <TacticRow key={i} icon={[Lightbulb, Target, Zap][i % 3]} text={tactic} />
                ))}
              </div>
            </section>

            {/* ── Section 4: Opposition Cheatsheet ─────────────────────────── */}
            <section className="space-y-4">
              <SectionLabel>What You&apos;re Up Against (Top Opposition)</SectionLabel>
              {oppArgs.length === 0 ? (
                <div className="p-4 rounded-xl border border-surface-300 bg-surface-200/30">
                  <p className="text-xs font-mono text-surface-500 text-center">
                    No opposition arguments yet — first mover advantage.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {oppArgs.slice(0, 3).map((arg) => (
                    <div
                      key={arg.id}
                      className="rounded-xl border border-surface-300/50 bg-surface-200/30 p-4 space-y-2"
                    >
                      <p className="text-xs font-mono text-surface-500 italic line-clamp-3">
                        &ldquo;{arg.content}&rdquo;
                      </p>
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-3 w-3 text-surface-600" />
                        <span className="text-[10px] font-mono text-surface-600">{arg.upvotes} upvotes</span>
                        {arg.ai_grade && (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                            GRADE_COLOR[arg.ai_grade[0]] ?? ''
                          )}>
                            {arg.ai_grade}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        'mt-2 pt-2 border-t border-surface-300/30 text-[10px] font-mono leading-relaxed',
                        isFor ? 'text-for-400/70' : 'text-against-400/70'
                      )}>
                        Counter: {isFor
                          ? getForCounter(arg.content)
                          : getAgainstCounter(arg.content)
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 5: Coalition Forces ───────────────────────────────── */}
            {ownCoalitions.length > 0 && (
              <section className="space-y-4">
                <SectionLabel>Allied Coalitions</SectionLabel>
                <div className="space-y-2">
                  {ownCoalitions.map((cs) => cs.coalition && (
                    <Link
                      key={cs.id}
                      href={`/coalitions/${cs.coalition.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-200/40 hover:border-surface-400 transition-colors"
                    >
                      <span className="text-lg">{cs.coalition.badge_emoji ?? '🏛'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-semibold text-white truncate">
                          {cs.coalition.name}
                        </p>
                        {cs.statement && (
                          <p className="text-[11px] font-mono text-surface-500 truncate mt-0.5">
                            {cs.statement}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-mono text-surface-500 flex-shrink-0">
                        <Users className="h-3 w-3" />
                        <span>{cs.coalition.member_count}</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/topic/${params.id}/coalitions`}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
                >
                  View all coalition stances <ChevronRight className="h-3 w-3" />
                </Link>
              </section>
            )}

            {/* ── Section 6: Swing-vote analysis ───────────────────────────── */}
            <section className={cn(
              'rounded-xl border p-5 space-y-3',
              'bg-surface-200/30 border-surface-300'
            )}>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-mono font-bold text-white">Swing-Vote Intelligence</h2>
              </div>
              <p className="text-sm font-mono text-surface-600 leading-relaxed">
                {swingInsight}
              </p>
            </section>

            {/* ── Section 7: Path to victory ────────────────────────────────── */}
            <section className={cn(
              'rounded-xl border p-5 space-y-3',
              isFor
                ? 'bg-for-500/5 border-for-500/20'
                : 'bg-against-500/5 border-against-500/20'
            )}>
              <div className="flex items-center gap-2">
                {isFor ? (
                  <Gavel className="h-4 w-4 text-for-400" />
                ) : (
                  <Shield className="h-4 w-4 text-against-400" />
                )}
                <h2 className="text-sm font-mono font-bold text-white">
                  {isFor ? 'Path to Law' : 'Path to Defeat'}
                </h2>
              </div>
              <p className="text-sm font-mono text-surface-600 leading-relaxed">
                {isFor ? pathToLaw : getPathToDefeat(forPct)}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/topic/${params.id}/momentum`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400 transition-colors"
                >
                  <TrendingUp className="h-3 w-3" />
                  Momentum
                </Link>
                <Link
                  href={`/topic/${params.id}/resolution`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400 transition-colors"
                >
                  <BarChart2 className="h-3 w-3" />
                  Resolution Criteria
                </Link>
                <Link
                  href={`/topic/${params.id}/forecast`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400 transition-colors"
                >
                  <Flame className="h-3 w-3" />
                  Forecast
                </Link>
              </div>
            </section>

            {/* ── Section 8: Quick action links ────────────────────────────── */}
            <section className="space-y-3">
              <SectionLabel>Deepen Your Research</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/topic/${params.id}/steelman`, icon: Award, label: 'Best Arguments' },
                  { href: `/topic/${params.id}/evidence`, icon: BookOpen, label: 'Evidence Base' },
                  { href: `/topic/${params.id}/frames`, icon: Globe, label: 'Ideological Frames' },
                  { href: `/topic/${params.id}/dissent`, icon: MessageSquare, label: 'Dissenting Views' },
                  { href: `/topic/${params.id}/brief`, icon: Zap, label: 'AI Brief' },
                  { href: `/topic/${params.id}/parallels`, icon: Trophy, label: 'Historical Parallels' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 p-3 rounded-xl border border-surface-300 bg-surface-200/30 hover:border-surface-400 hover:bg-surface-200/60 transition-colors"
                  >
                    <link.icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                    <span className="text-xs font-mono text-surface-400 hover:text-surface-300">
                      {link.label}
                    </span>
                    <ChevronRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>

          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Counter-argument helpers ─────────────────────────────────────────────────

function getForCounter(oppContent: string): string {
  const lower = oppContent.toLowerCase()
  if (lower.includes('cost') || lower.includes('expensive') || lower.includes('budget')) {
    return 'Reframe as investment: quantify the long-term cost of inaction. Compare to the cost of alternatives.'
  }
  if (lower.includes('freedom') || lower.includes('right') || lower.includes('liberty')) {
    return 'Distinguish between individual freedom and collective harm. The policy protects more rights than it restricts.'
  }
  if (lower.includes('unintended') || lower.includes('consequence') || lower.includes('backfire')) {
    return 'Cite pilot programmes or jurisdictions where this succeeded. Propose safeguards to catch unintended effects early.'
  }
  if (lower.includes('evidence') || lower.includes('research') || lower.includes('study')) {
    return 'Point to the weight of evidence, not single studies. Acknowledge uncertainty while affirming the balance of proof.'
  }
  return 'Acknowledge the concern, then show why the policy\'s benefits outweigh this risk with specific evidence.'
}

function getAgainstCounter(forContent: string): string {
  const lower = forContent.toLowerCase()
  if (lower.includes('benefit') || lower.includes('improve') || lower.includes('help')) {
    return 'Ask: who specifically benefits, and at whose expense? Demand the distributional analysis behind aggregate claims.'
  }
  if (lower.includes('evidence') || lower.includes('study') || lower.includes('data')) {
    return 'Request: is this the strongest available evidence? Have these studies been replicated in comparable contexts?'
  }
  if (lower.includes('consensus') || lower.includes('expert') || lower.includes('scientist')) {
    return 'Note: expert consensus can be wrong, and policy involves value trade-offs that experts alone can\'t resolve.'
  }
  if (lower.includes('urgent') || lower.includes('crisis') || lower.includes('emergency')) {
    return 'Urgency framing often leads to poorly-designed policy. Slow down, pilot first, then scale with evidence.'
  }
  return 'Challenge the core assumption. Ask what would need to be false for this argument to fail.'
}

function getPathToDefeat(forPct: number): string {
  if (forPct >= 75) {
    return 'Law threshold has been crossed. Focus on amendment proposals and veto challenges to modify or reverse this outcome.'
  }
  if (forPct >= 60) {
    return `${forPct}% FOR — dangerously close to the 75% threshold. Your priority: prevent further drift. Find the persuadables and target them with the strongest counter-arguments.`
  }
  if (forPct >= 50) {
    return `${forPct}% FOR — narrow FOR majority. Maintain pressure with high-quality arguments. Draw on historical parallels where similar proposals failed.`
  }
  return `Holding strong at ${forPct}% FOR. Keep feeding quality counter-arguments into the debate. A consistent drumbeat of evidence will consolidate the AGAINST majority.`
}
