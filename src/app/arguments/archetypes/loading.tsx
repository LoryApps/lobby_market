import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArchetypesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>
        {/* Summary strip */}
        <Skeleton className="h-10 w-full rounded-xl" />
        {/* Sort controls */}
        <div className="flex gap-1.5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)}
        </div>
        {/* Cards */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-300/30 bg-surface-100/40 p-4 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-14 rounded-lg" />)}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
