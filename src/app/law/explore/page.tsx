import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileEdit,
  FileText,
  Flame,
  Gavel,
  GitBranch,
  GitCompare,
  Globe,
  History,
  LayoutGrid,
  MessageSquare,
  Mic,
  Network,
  Scale,
  Search,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
  Clock,
  Map,
  Calendar,
  BookMarked,
  Target,
  Award,
  Scroll,
  FlaskConical,
  Cpu,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Explore the Law Codex · Lobby Market',
  description:
    'Your complete guide to the Lobby Market Law Codex — browse established laws, analyse impacts, challenge rulings, track amendments, and explore every tool for civic legislation.',
  openGraph: {
    title: 'Explore the Law Codex · Lobby Market',
    description:
      'Every tool for navigating, analysing, and engaging with laws established by community consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Explore the Law Codex · Lobby Market',
    description: 'All law analysis tools — browse, compare, challenge, and review established laws.',
  },
}

// ─── Section config ───────────────────────────────────────────────────────────

interface LawTool {
  href: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface ToolSection {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  tools: LawTool[]
}

const SECTIONS: ToolSection[] = [
  {
    id: 'browse',
    label: 'Browse & Discover',
    description: 'Explore the full Codex — find laws by category, scope, time, and more.',
    icon: Search,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    tools: [
      { href: '/law', label: 'The Codex', description: 'All established laws — searchable, sortable, filterable.', icon: Gavel },
      { href: '/law/categories', label: 'Browse by Category', description: 'Explore laws grouped by Politics, Economics, Technology, and more.', icon: LayoutGrid },
      { href: '/law/atlas', label: 'Law Atlas', description: 'Geographic matrix — laws by scope (Global, National, Regional, Local).', icon: Globe },
      { href: '/law/graph', label: 'Law Knowledge Graph', description: 'Interactive network of how established laws relate and connect.', icon: Network },
      { href: '/law/timeline', label: 'Timeline', description: 'Chronological history of every law established on the platform.', icon: Clock },
      { href: '/law/today', label: 'Today\'s Law Activity', description: 'What\'s happening in the Codex right now — new laws, active discussions.', icon: Flame },
      { href: '/law/monthly', label: 'Monthly Digest', description: 'Each month in the Codex — laws established, debates that led here.', icon: Calendar },
      { href: '/law/wiki/recent', label: 'Recent Wiki Edits', description: 'Latest community contributions to law wiki pages.', icon: FileEdit },
    ],
  },
  {
    id: 'analyse',
    label: 'Analyse & Compare',
    description: 'Deep analytics across the entire law corpus — quality, conflict, and coverage.',
    icon: BarChart2,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    tools: [
      { href: '/law/compare', label: 'Law Comparison', description: 'Compare two laws side-by-side — vote splits, community ratings, and more.', icon: GitCompare },
      { href: '/law/quality', label: 'Quality Rankings', description: 'Laws ranked by community confidence, argument quality, and evidence.', icon: Star },
      { href: '/law/ratings', label: 'Community Ratings', description: 'How citizens rate established laws — aggregate scores and breakdowns.', icon: Trophy },
      { href: '/law/health', label: 'Codex Health Report', description: 'Platform-wide statistics on the law corpus — coverage, gaps, and trends.', icon: FlaskConical },
      { href: '/law/conflicts', label: 'Law Conflicts', description: 'Laws that may contradict each other — automatically detected and flagged.', icon: AlertTriangle },
    ],
  },
  {
    id: 'community',
    label: 'Community & Participation',
    description: 'Challenges, verdicts, reviews — how citizens engage with established laws.',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    tools: [
      { href: '/law/challenges', label: 'Active Challenges', description: 'Formal challenges filed against laws on constitutional, factual, and ethical grounds.', icon: Shield },
      { href: '/law/verdicts', label: 'Community Verdicts', description: 'Retrospective assessments — did these laws actually achieve their goals?', icon: Scale },
      { href: '/law/reviews', label: 'Law Reviews', description: 'In-depth community reviews of established laws — analysis and critique.', icon: BookOpen },
    ],
  },
  {
    id: 'deep-dive',
    label: 'Per-Law Deep Dives',
    description: 'Every tool available when you open a specific law — 50+ analysis modes.',
    icon: Sparkles,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    tools: [
      { href: '/law/search', label: 'Search Laws', description: 'Find the law you want to analyse with full-text search across all established laws.', icon: Search, badge: 'Start here' },
      { href: '/law/search', label: 'Blueprint', description: 'Full legislative blueprint — scope, intent, arguments that passed it, and vote record.', icon: FileText },
      { href: '/law/search', label: 'Impact Analysis', description: 'Modelled effects of the law — what changed, who it affects, and how.', icon: TrendingUp },
      { href: '/law/search', label: 'Debate Record', description: 'Every structured debate that helped shape consensus on this law.', icon: Mic },
      { href: '/law/search', label: 'Amendment History', description: 'Changes proposed after the law was established — accepted and rejected.', icon: GitBranch },
      { href: '/law/search', label: 'Wiki Article', description: 'Community-written wiki context — history, implementation, real-world effects.', icon: BookMarked },
      { href: '/law/search', label: 'AI Counsel', description: 'AI-generated legal analysis, precedent comparison, and critical questions.', icon: Brain },
      { href: '/law/search', label: 'Voter Breakdown', description: 'Who voted for this law, their demographics, and consensus journey.', icon: Vote },
      { href: '/law/search', label: 'Similar Laws', description: 'Laws most like this one — by category, scope, and argument overlap.', icon: GitCompare },
      { href: '/law/search', label: 'Narrative Arc', description: 'AI journalistic story of how this debate became law — the human story.', icon: Scroll },
    ],
  },
  {
    id: 'ai-tools',
    label: 'AI Law Tools',
    description: 'AI-powered analysis, generation, and exploration across the Codex.',
    icon: Cpu,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    tools: [
      { href: '/law/search', label: 'Law Fault Lines', description: 'AI detection of ideological divides in any law\'s support base.', icon: AlertTriangle },
      { href: '/law/search', label: 'Steelman Analysis', description: 'The strongest possible case for and against any established law.', icon: Scale },
      { href: '/law/search', label: 'What-If Simulation', description: 'Model alternate vote outcomes — what if 5% more voted against?', icon: FlaskConical },
      { href: '/law/search', label: 'Category Benchmark', description: 'How this law ranks against others in its category.', icon: Target },
      { href: '/law/search', label: 'Swing Analysis', description: 'Which arguments had the biggest persuasive impact on the vote.', icon: Zap },
      { href: '/law/search', label: 'Primer', description: 'Beginner-friendly explainer for any law — no jargon.', icon: BookOpen },
    ],
  },
]

// ─── Tool card ────────────────────────────────────────────────────────────────

function ToolCard({ tool, color }: { tool: LawTool; color: string }) {
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className={cn(
        'group relative flex flex-col gap-2 p-3.5 rounded-xl',
        'bg-surface-200/60 border border-surface-300/60',
        'hover:border-surface-400/80 hover:bg-surface-200/90 transition-all',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('flex-shrink-0 p-1.5 rounded-lg bg-surface-300/60', color.replace('text-', 'bg-').replace('400', '500/10').replace('300', '500/10'))}>
          <Icon className={cn('h-3.5 w-3.5', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-white leading-tight">{tool.label}</span>
            {tool.badge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gold/20 text-gold border border-gold/30">
                {tool.badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-500 leading-tight mt-0.5 line-clamp-2">{tool.description}</p>
        </div>
      </div>
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LawExplorePage() {
  const supabase = await createClient()

  // Quick stats
  const [lawCount, voteCount] = await Promise.all([
    supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => count ?? 0),
    supabase
      .from('laws')
      .select('total_votes')
      .eq('is_active', true)
      .then(({ data }) =>
        (data ?? []).reduce((s, r) => s + ((r as { total_votes?: number | null }).total_votes ?? 0), 0)
      ),
  ])

  // Category counts
  const { data: catRows } = await supabase
    .from('laws')
    .select('category')
    .eq('is_active', true)

  const categoryCount = new Set((catRows ?? []).map((r: { category: string | null }) => r.category).filter(Boolean)).size

  const totalTools = SECTIONS.reduce((s, sec) => s + sec.tools.length, 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <Gavel className="h-3.5 w-3.5" />
            The Codex
          </Link>
        </div>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30">
                <Gavel className="h-6 w-6 text-emerald" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Explore the Codex</h1>
                <p className="text-sm text-surface-500 mt-0.5">Every tool for navigating the Law Codex</p>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Established Laws', value: lawCount.toLocaleString(), icon: Gavel, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/25' },
              { label: 'Total Votes Cast', value: voteCount >= 1_000_000 ? `${(voteCount / 1_000_000).toFixed(1)}M` : voteCount >= 1_000 ? `${(voteCount / 1_000).toFixed(1)}K` : voteCount.toLocaleString(), icon: Vote, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/25' },
              { label: 'Categories Covered', value: categoryCount.toString(), icon: LayoutGrid, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/25' },
            ].map((stat) => {
              const StatIcon = stat.icon
              return (
                <div
                  key={stat.label}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-3 rounded-xl border text-center',
                    stat.bg,
                    stat.border,
                  )}
                >
                  <StatIcon className={cn('h-4 w-4', stat.color)} />
                  <span className={cn('text-lg font-bold font-mono', stat.color)}>{stat.value}</span>
                  <span className="text-[10px] text-surface-500 leading-tight">{stat.label}</span>
                </div>
              )
            })}
          </div>

          <p className="text-sm text-surface-500 leading-relaxed">
            {totalTools} law tools across {SECTIONS.length} sections — browse the Codex, analyse individual laws,
            challenge rulings, track amendments, and explore AI-powered legislative insights.
          </p>
        </div>

        {/* ── Sections ──────────────────────────────────────────────────── */}
        <div className="space-y-8">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon
            return (
              <section key={section.id}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border', section.bg, section.border)}>
                    <SectionIcon className={cn('h-4 w-4', section.color)} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">{section.label}</h2>
                    <p className="text-[11px] text-surface-500">{section.description}</p>
                  </div>
                </div>

                {/* Tool grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {section.tools.map((tool) => (
                    <ToolCard key={tool.href + tool.label} tool={tool} color={section.color} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div className="mt-10 p-5 rounded-2xl bg-surface-200/60 border border-surface-300/60 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Looking for a specific law?</p>
            <p className="text-xs text-surface-500 mt-0.5">Search the full Codex by keyword, category, or vote split.</p>
          </div>
          <Link
            href="/law/search"
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald/15 border border-emerald/30 text-emerald text-xs font-semibold hover:bg-emerald/25 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Search Laws
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
