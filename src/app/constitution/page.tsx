import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Gavel, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import {
  ConstitutionDocument,
  type ConstitutionArticle,
  type ConstitutionLaw,
} from '@/components/constitution/ConstitutionDocument'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'The Civic Constitution · Lobby Market',
  description:
    'A living constitutional document of every consensus law established by democratic vote in the Lobby Market community.',
  openGraph: {
    title: 'The Civic Constitution · Lobby Market',
    description:
      'Every law debated and ratified by the Lobby, organized into constitutional articles. Democracy in action.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Constitution · Lobby Market',
    description:
      'A living constitution generated from community consensus — vote by vote, law by law.',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Category ordering and metadata ──────────────────────────────────────────

interface CategoryMeta {
  icon: string
  color: string
  bg: string
  border: string
  order: number
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  Politics:    { icon: '🏛️', color: 'text-for-400',     bg: 'bg-for-500/5',     border: 'border-for-500/20',     order: 1 },
  Economics:   { icon: '📊', color: 'text-gold',          bg: 'bg-gold/5',         border: 'border-gold/20',         order: 2 },
  Technology:  { icon: '⚡', color: 'text-purple',        bg: 'bg-purple/5',       border: 'border-purple/20',       order: 3 },
  Science:     { icon: '🔬', color: 'text-emerald',       bg: 'bg-emerald/5',      border: 'border-emerald/20',      order: 4 },
  Ethics:      { icon: '⚖️', color: 'text-against-400',  bg: 'bg-against-500/5',  border: 'border-against-500/20',  order: 5 },
  Philosophy:  { icon: '📚', color: 'text-for-300',       bg: 'bg-for-400/5',      border: 'border-for-400/20',      order: 6 },
  Culture:     { icon: '🎭', color: 'text-gold',          bg: 'bg-gold/5',         border: 'border-gold/15',         order: 7 },
  Health:      { icon: '🩺', color: 'text-against-300',  bg: 'bg-against-400/5',  border: 'border-against-400/15',  order: 8 },
  Environment: { icon: '🌿', color: 'text-emerald',       bg: 'bg-emerald/5',      border: 'border-emerald/15',      order: 9 },
  Education:   { icon: '🎓', color: 'text-purple',        bg: 'bg-purple/5',       border: 'border-purple/15',       order: 10 },
  Other:       { icon: '📋', color: 'text-surface-400',  bg: 'bg-surface-300/5',  border: 'border-surface-300/20',  order: 99 },
}

const DEFAULT_META: CategoryMeta = {
  icon: '📋',
  color: 'text-surface-400',
  bg: 'bg-surface-300/5',
  border: 'border-surface-300/20',
  order: 50,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConstitutionPage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, topic_id, statement, full_statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: true })

  const laws = (lawRows ?? []) as ConstitutionLaw[]

  // ── Group into articles ────────────────────────────────────────────────────

  const byCategory = new Map<string, ConstitutionLaw[]>()
  for (const law of laws) {
    const cat = law.category ?? 'Other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(law)
  }

  // Sort categories by configured order, then alphabetically within ties
  const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
    const oa = (CATEGORY_META[a] ?? DEFAULT_META).order
    const ob = (CATEGORY_META[b] ?? DEFAULT_META).order
    if (oa !== ob) return oa - ob
    return a.localeCompare(b)
  })

  const articles: ConstitutionArticle[] = sortedCategories.map((cat, idx) => {
    const meta = CATEGORY_META[cat] ?? DEFAULT_META
    return {
      ordinal: idx + 1,
      romanNumeral: toRomanServer(idx + 1),
      category: cat,
      laws: byCategory.get(cat)!,
      icon: meta.icon,
      color: meta.color,
      bg: meta.bg,
      border: meta.border,
    }
  })

  // ── Summary stats ──────────────────────────────────────────────────────────

  const totalLaws = laws.length
  const totalVotes = laws.reduce((sum, l) => sum + (l.total_votes ?? 0), 0)
  const ratifiedAt = laws[0]?.established_at ?? null
  const lastAmendedAt = laws.length > 0
    ? laws.reduce((latest, l) =>
        l.established_at > latest ? l.established_at : latest,
        laws[0].established_at
      )
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/law"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Law Codex"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white truncate">
              The Civic Constitution
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {totalLaws} laws across {articles.length} articles
            </p>
          </div>
          <Link
            href="/topic/create"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border',
              'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              'transition-colors flex-shrink-0'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Propose
          </Link>
        </div>

        {/* ── Constitution document ──────────────────────────────────── */}
        <ConstitutionDocument
          articles={articles}
          totalLaws={totalLaws}
          totalVotes={totalVotes}
          ratifiedAt={ratifiedAt}
          lastAmendedAt={lastAmendedAt}
        />

        {/* ── Related links ─────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              href: '/law',
              icon: BookOpen,
              label: 'Law Codex',
              desc: 'Full searchable index',
              color: 'text-gold',
              bg: 'bg-gold/5',
              border: 'border-gold/20',
            },
            {
              href: '/law/graph',
              icon: Gavel,
              label: 'Law Graph',
              desc: 'Visual law network',
              color: 'text-purple',
              bg: 'bg-purple/5',
              border: 'border-purple/20',
            },
            {
              href: '/law/atlas',
              icon: BookOpen,
              label: 'Law Atlas',
              desc: 'Explore by category',
              color: 'text-emerald',
              bg: 'bg-emerald/5',
              border: 'border-emerald/20',
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                item.bg,
                item.border,
                'hover:border-surface-400'
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', item.color)} />
              <div className="min-w-0">
                <p className={cn('text-xs font-mono font-semibold', item.color)}>{item.label}</p>
                <p className="text-[10px] font-mono text-surface-500">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Server-side Roman numeral (keep out of client bundle) ────────────────────

function toRomanServer(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
  let result = ''
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i]
      n -= vals[i]
    }
  }
  return result
}
