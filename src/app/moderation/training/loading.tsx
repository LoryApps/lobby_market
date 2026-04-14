import { Shield } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ModerationTrainingLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Simple inline top bar (no auth nav needed) */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Progress header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Shield className="h-5 w-5 text-against-400" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>

        {/* Case card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Content block */}
          <div className="rounded-xl bg-surface-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Verdict buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
