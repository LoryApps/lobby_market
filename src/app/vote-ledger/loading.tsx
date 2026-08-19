import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function VoteLedgerLoading() {
  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Consensus bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <Skeleton className="h-3.5 w-16 rounded" />
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>

        {/* Filter pills */}
        <div className="flex gap-3 mb-5">
          <Skeleton className="h-9 w-52 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg ml-auto" />
        </div>

        {/* Vote list */}
        <div className="bg-surface-900 border border-surface-800 rounded-xl overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-surface-800 last:border-0">
              <div className="w-2 h-2 rounded-full bg-surface-700 mt-2 flex-shrink-0" />
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
                <Skeleton className="h-3.5 w-full max-w-xs rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
