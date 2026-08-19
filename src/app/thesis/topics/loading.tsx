import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function TopicThesisSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="px-4 py-2 border-t border-surface-300/60 bg-surface-200/30">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="p-3 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-surface-200/60 p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ThesisTopicsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        {/* Sort bar */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg flex-shrink-0" />
          ))}
        </div>
        {/* Cards */}
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <TopicThesisSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
