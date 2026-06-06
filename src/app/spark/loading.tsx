import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SparkLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header skeleton */}
        <div className="mb-8 text-center space-y-2">
          <Skeleton className="h-10 w-10 rounded-xl mx-auto" />
          <Skeleton className="h-7 w-36 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        {/* Card skeleton */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-16 ml-auto rounded-md" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
