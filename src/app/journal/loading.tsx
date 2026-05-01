import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function JournalEntrySkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden">
      {/* Entry header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          {/* Topic link */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-200/50 border border-surface-300">
            <Skeleton className="h-4 w-4 rounded flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        </div>
        <Skeleton className="h-7 w-14 rounded-lg flex-shrink-0" />
      </div>
      {/* Entry body */}
      <div className="px-4 pb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-200/50 flex items-center gap-3">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-6 rounded-lg ml-auto" />
      </div>
    </div>
  )
}

export default function JournalLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-xl flex-shrink-0" />
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        </div>

        {/* Mood filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-22 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Journal entries */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <JournalEntrySkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
