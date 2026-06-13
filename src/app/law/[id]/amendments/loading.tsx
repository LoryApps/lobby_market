import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>

        {/* Law card */}
        <Skeleton className="h-20 w-full rounded-2xl" />

        {/* Info strip */}
        <Skeleton className="h-12 w-full rounded-xl" />

        {/* Propose form placeholder */}
        <Skeleton className="h-14 w-full rounded-2xl" />

        {/* Tabs */}
        <Skeleton className="h-10 w-full rounded-xl" />

        {/* Amendments */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-300/60 bg-surface-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
