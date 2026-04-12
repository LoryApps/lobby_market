import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawCardProps {
  law: Law
}

function excerpt(text: string | null, len = 120): string {
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

export function LawCard({ law }: LawCardProps) {
  const bluePct = Math.round(law.blue_pct ?? 0)
  const winPct = bluePct >= 50 ? bluePct : 100 - bluePct
  const sideColor = bluePct >= 50 ? 'text-for-400' : 'text-against-400'
  const sideLabel = bluePct >= 50 ? 'FOR' : 'AGAINST'

  return (
    <Link
      href={`/law/${law.id}`}
      className={cn(
        'group block bg-surface-100 border border-surface-300 rounded-xl p-5',
        'hover:border-emerald/50 hover:bg-emerald/[0.03]',
        'transition-all duration-200'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-mono text-base font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
          {law.statement}
        </h3>
        <div
          className={cn(
            'flex-shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold',
            'bg-surface-200 border border-surface-300',
            sideColor
          )}
        >
          {sideLabel} {winPct}%
        </div>
      </div>

      {law.full_statement && law.full_statement !== law.statement && (
        <p className="font-mono text-[12px] text-surface-500 leading-relaxed line-clamp-3 mb-4">
          {excerpt(law.full_statement, 140)}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-surface-300/60">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
          <Users className="h-3 w-3" />
          <span>{(law.total_votes ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(law.established_at)}</span>
        </div>
      </div>
    </Link>
  )
}
