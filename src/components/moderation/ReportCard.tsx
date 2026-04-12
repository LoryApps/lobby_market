import { AlertTriangle, Clock, Flag } from 'lucide-react'
import type { Report, ReportStatus, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

type ReportWithReporter = Report & {
  reporter?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface ReportCardProps {
  report: ReportWithReporter
  onClick?: () => void
}

const statusStyles: Record<ReportStatus, string> = {
  pending: 'bg-gold/10 text-gold border-gold/30',
  reviewing: 'bg-for-500/10 text-for-400 border-for-500/30',
  resolved: 'bg-emerald/10 text-emerald border-emerald/30',
  dismissed: 'bg-surface-300/40 text-surface-500 border-surface-300',
  escalated: 'bg-against-500/10 text-against-400 border-against-500/30',
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export function ReportCard({ report, onClick }: ReportCardProps) {
  const statusClass = statusStyles[report.status]
  const reporterName =
    report.reporter?.display_name ?? report.reporter?.username ?? 'anonymous'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left block rounded-xl bg-surface-100 border border-surface-300 p-5',
        'hover:border-emerald/40 hover:bg-emerald/[0.03]',
        'transition-all duration-200 group'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-against-500/10 border border-against-500/30 text-against-400 flex-shrink-0">
            <Flag className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-surface-500">
              {report.reported_content_type}
            </div>
            <h3 className="font-mono text-sm font-semibold text-white truncate group-hover:text-emerald transition-colors">
              {report.reason}
            </h3>
          </div>
        </div>
        <span
          className={cn(
            'flex-shrink-0 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase border',
            statusClass
          )}
        >
          {report.status}
        </span>
      </div>

      {report.description && (
        <p className="mt-3 font-mono text-xs text-surface-600 line-clamp-3 leading-relaxed">
          {report.description}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-surface-300/60 flex items-center justify-between font-mono text-[11px] text-surface-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">@{reporterName}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Clock className="h-3 w-3" />
          <span>{formatTime(report.created_at)}</span>
        </div>
      </div>
    </button>
  )
}
