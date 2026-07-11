import { Users } from 'lucide-react'

export default function DelegationNetworkLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50 overflow-hidden">
      {/* Header skeleton */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-300 bg-surface-100">
        <div className="h-8 w-8 rounded-lg bg-surface-300 animate-pulse" />
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
            <Users className="h-4 w-4 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 rounded bg-surface-300 animate-pulse" />
            <div className="h-3 w-24 rounded bg-surface-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Canvas placeholder */}
      <div className="flex-1 flex items-center justify-center bg-surface-50">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto">
            <Users className="h-6 w-6 text-surface-400 animate-pulse" />
          </div>
          <p className="text-sm text-surface-400 animate-pulse">Loading delegation graph…</p>
        </div>
      </div>
    </div>
  )
}
