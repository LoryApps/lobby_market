import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function StanceShareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        {/* Badge skeleton */}
        <div className="flex justify-center mb-8">
          <Skeleton className="h-10 w-48 rounded-full" />
        </div>

        {/* Topic card skeleton */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-6 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <Skeleton className="h-16 rounded-xl" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
