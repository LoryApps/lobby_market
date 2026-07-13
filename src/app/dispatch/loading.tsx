import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DispatchLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-surface-400 to-surface-300" />
            <div className="h-4 w-4 rounded bg-surface-400/40" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-surface-400 to-surface-300" />
          </div>
          <Skeleton className="h-8 w-52 mx-auto mb-2" />
          <Skeleton className="h-3 w-40 mx-auto mb-3" />
          <Skeleton className="h-3 w-64 mx-auto mb-4" />
          <div className="h-px bg-surface-300 w-full" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>

        {/* Law section */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2 pb-3 border-b border-gold/20">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-32" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>

        {/* Topics section */}
        <div className="space-y-2 mb-8">
          <div className="flex items-center gap-2 pb-3 border-b border-for-500/20">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="rounded-xl border border-surface-300/50 divide-y divide-surface-300/40">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5 px-3">
                <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-1 w-full rounded-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debates section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-3 border-b border-purple/20">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-44" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
