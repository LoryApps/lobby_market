import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function OutlierCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

export default function OutliersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Hero skeleton */}
        <div className="mb-6">
          <Skeleton className="h-3 w-20 mb-4" />
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-xl mt-4" />
        </div>

        {/* Toolbar skeleton */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <div className="flex gap-1 ml-auto">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <OutlierCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
