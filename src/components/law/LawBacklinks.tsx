'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownLeft, Layers } from 'lucide-react'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawBacklinksProps {
  outgoingLinks: Law[]
  incomingLinks: Law[]
  relatedLaws: Law[]
}

function excerpt(text: string | null, len = 90): string {
  if (!text) return ''
  const clean = text.trim()
  if (clean.length <= len) return clean
  return clean.slice(0, len).trimEnd() + '…'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface LawLinkCardProps {
  law: Law
  accent: 'outgoing' | 'incoming' | 'related'
}

function LawLinkCard({ law, accent }: LawLinkCardProps) {
  const accentClass =
    accent === 'outgoing'
      ? 'hover:border-emerald/60 hover:bg-emerald/5'
      : accent === 'incoming'
        ? 'hover:border-for-500/60 hover:bg-for-500/5'
        : 'hover:border-purple/60 hover:bg-purple/5'

  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'block p-3 rounded-lg border border-surface-300 bg-surface-200/50',
        'transition-all group',
        accentClass
      )}
    >
      <h4 className="font-mono text-[13px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
        {law.statement}
      </h4>
      {law.full_statement && (
        <p className="mt-1.5 text-[11px] text-surface-500 font-mono line-clamp-2 leading-relaxed">
          {excerpt(law.full_statement, 100)}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-emerald/70">
          {Math.round(law.blue_pct ?? 0)}%
        </span>
        <span>{formatDate(law.established_at)}</span>
      </div>
    </Link>
  )
}

interface SectionProps {
  title: string
  count: number
  icon: React.ReactNode
  children: React.ReactNode
  emptyText: string
}

function Section({ title, count, icon, children, emptyText }: SectionProps) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-3 px-1">
        <span className="text-surface-500">{icon}</span>
        <h3 className="text-[11px] uppercase tracking-widest text-surface-500 font-mono font-semibold">
          {title}
        </h3>
        {count > 0 && (
          <span className="ml-auto text-[10px] font-mono text-surface-500 bg-surface-200 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </header>
      {count > 0 ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="text-[11px] text-surface-500 italic font-mono px-1 pb-2">
          {emptyText}
        </p>
      )}
    </section>
  )
}

export function LawBacklinks({
  outgoingLinks,
  incomingLinks,
  relatedLaws,
}: LawBacklinksProps) {
  return (
    <aside
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-xl p-4',
        'space-y-6 sticky top-20',
        'max-h-[calc(100vh-6rem)] overflow-y-auto'
      )}
    >
      <Section
        title="Linked Laws"
        count={outgoingLinks.length}
        icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        emptyText="This Law references no others."
      >
        {outgoingLinks.map((law) => (
          <LawLinkCard key={law.id} law={law} accent="outgoing" />
        ))}
      </Section>

      <Section
        title="Backlinks"
        count={incomingLinks.length}
        icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
        emptyText="No other Laws reference this one yet."
      >
        {incomingLinks.map((law) => (
          <LawLinkCard key={law.id} law={law} accent="incoming" />
        ))}
      </Section>

      <Section
        title="Related"
        count={relatedLaws.length}
        icon={<Layers className="h-3.5 w-3.5" />}
        emptyText="No related Laws in this category."
      >
        {relatedLaws.map((law) => (
          <LawLinkCard key={law.id} law={law} accent="related" />
        ))}
      </Section>
    </aside>
  )
}
