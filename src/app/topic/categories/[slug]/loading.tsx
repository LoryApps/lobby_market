import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CategoryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-40 rounded mb-5" />

        {/* Hero skeleton */}
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300 mb-6">
          <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-36 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-1.5">
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Section heading skeleton */}
        <Skeleton className="h-4 w-28 rounded mb-3" />

        {/* Topic rows skeleton */}
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <div className="flex gap-2 mt-1">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-3 w-12 rounded ml-auto" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
