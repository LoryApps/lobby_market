'use client'

import { useEffect, useState } from 'react'
import { Loader2, Shield, ShieldAlert } from 'lucide-react'
import type { Report, ReportStatus, Profile } from '@/lib/supabase/types'
import { ReportCard } from './ReportCard'
import { ReportReviewModal } from './ReportReviewModal'
import { cn } from '@/lib/utils/cn'

type ReportWithReporter = Report & {
  reporter?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface ReportQueueProps {
  initialReports?: ReportWithReporter[]
  initialStatus?: ReportStatus
}

const tabs: Array<{ id: ReportStatus; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
]

export function ReportQueue({
  initialReports,
  initialStatus = 'pending',
}: ReportQueueProps) {
  const [status, setStatus] = useState<ReportStatus>(initialStatus)
  const [reports, setReports] = useState<ReportWithReporter[]>(
    initialReports ?? []
  )
  const [loading, setLoading] = useState(!initialReports)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReportWithReporter | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/reports?status=${status}`)
        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? 'Troll Catcher role required'
              : 'Failed to load reports'
          )
        }
        const data = await res.json()
        if (cancelled) return
        setReports(data.reports ?? [])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status])

  const handleResolved = (resolved: Report) => {
    setReports((prev) => prev.filter((r) => r.id !== resolved.id))
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-surface-300 pb-2 mb-5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors whitespace-nowrap',
              status === tab.id
                ? 'bg-emerald/10 text-emerald border border-emerald/30'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-surface-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm font-mono">Loading queue…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-against-400 mb-3" />
          <p className="font-mono text-sm text-against-400">{error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="h-10 w-10 text-surface-500 mb-3" />
          <p className="font-mono text-sm text-white">Queue is clear</p>
          <p className="font-mono text-xs text-surface-500 mt-1">
            No {status} reports right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onClick={() => setSelected(report)}
            />
          ))}
        </div>
      )}

      <ReportReviewModal
        open={!!selected}
        report={selected}
        onClose={() => setSelected(null)}
        onResolved={handleResolved}
      />
    </>
  )
}
