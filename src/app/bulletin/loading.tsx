import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-3.5 w-16 rounded" />
                  <Skeleton className="h-3.5 w-12 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BulletinLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
          {/* Header skeleton */}
          <div className="mb-6">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>

          {/* Stats strip skeleton */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                <Skeleton className="h-5 w-5 mx-auto mb-2 rounded-full" />
                <Skeleton className="h-6 w-10 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto mb-1" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
            ))}
          </div>

          <SectionSkeleton rows={3} />
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={3} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
