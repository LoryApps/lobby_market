import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Gavel,
  MessageSquare,
  Scale,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawDiscussChat } from '@/components/law/LawDiscussChat'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

// ─── OG Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Discussion · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Discuss: ${short} · Lobby Market`
  const description =
    `Citizens discussing the implications of this established law — ` +
    `its effects, enforcement, and legacy. ${(law.total_votes ?? 0).toLocaleString()} votes in the original debate${law.category ? ` · ${law.category}` : ''}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: { canonical: `https://lobby.market/law/${params.id}/discuss` },
  }
}

// ─── Category badge colour ────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold border-gold/30 bg-gold/10',
  Politics: 'text-for-400 border-for-500/30 bg-for-500/10',
  Technology: 'text-purple border-purple/30 bg-purple/10',
  Science: 'text-emerald border-emerald/30 bg-emerald/10',
  Ethics: 'text-against-400 border-against-500/30 bg-against-500/10',
  Philosophy: 'text-for-300 border-for-400/30 bg-for-400/10',
  Culture: 'text-gold border-gold/30 bg-gold/10',
  Health: 'text-emerald border-emerald/30 bg-emerald/10',
  Environment: 'text-emerald border-emerald/30 bg-emerald/10',
  Education: 'text-purple border-purple/30 bg-purple/10',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LawDiscussPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  const catStyle = CAT_COLOR[law.category ?? ''] ?? 'text-surface-400 border-surface-400/30 bg-surface-300/20'

  const establishedDate = law.established_at
    ? new Date(law.established_at).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28 md:pb-8 flex flex-col gap-4">

        {/* Back nav */}
        <Link
          href={`/law/${law.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {/* Law header card */}
        <div className="rounded-2xl bg-surface-100 border border-gold/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Gavel className="h-4.5 w-4.5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[10px] font-mono text-gold uppercase tracking-widest">
                  Established Law
                </span>
                {law.category && (
                  <span
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wide',
                      catStyle
                    )}
                  >
                    {law.category}
                  </span>
                )}
                {establishedDate && (
                  <span className="text-[10px] font-mono text-surface-500">
                    {establishedDate}
                  </span>
                )}
              </div>
              <h1 className="text-base font-semibold text-white leading-snug">
                {law.statement}
              </h1>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-300/50">
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Users className="h-3.5 w-3.5" />
              <span className="font-mono">
                {(law.total_votes ?? 0).toLocaleString()} votes
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <Scale className="h-3.5 w-3.5 text-gold" />
              <span className="font-mono text-gold">Passed into law</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-surface-500">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="font-mono">Open discussion</span>
            </div>
          </div>
        </div>

        {/* What this is — context blurb */}
        <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 px-4 py-3">
          <p className="text-xs text-surface-400 leading-relaxed">
            <strong className="text-surface-300">Law Discussion</strong> is an open space to reflect on this
            law&apos;s implications — its effects, enforcement challenges, real-world parallels, and what comes
            next. Distinct from{' '}
            <Link href={`/law/${law.id}/amendments`} className="text-for-400 hover:text-for-300 underline">
              Amendments
            </Link>{' '}
            (formal proposals) and{' '}
            <Link href={`/law/${law.id}/wiki`} className="text-for-400 hover:text-for-300 underline">
              the Wiki
            </Link>{' '}
            (structured knowledge). Keep it civil and on-topic.
          </p>
        </div>

        {/* Chat panel */}
        <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300/50 overflow-hidden flex flex-col"
             style={{ minHeight: '480px' }}>
          <LawDiscussChat lawId={law.id} />
        </div>

        {/* Links to related pages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { href: `/law/${law.id}/amendments`, label: 'Amendments', icon: '⚖️' },
            { href: `/law/${law.id}/wiki`, label: 'Wiki', icon: '📖' },
            { href: `/law/${law.id}/community`, label: 'Community', icon: '🏛️' },
            { href: `/law/${law.id}/counsel`, label: 'AI Counsel', icon: '🤖' },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl',
                'text-xs font-mono text-surface-400 hover:text-white',
                'bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60',
                'transition-colors'
              )}
            >
              <span className="text-sm" aria-hidden="true">{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
