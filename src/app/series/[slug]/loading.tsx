import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SeriesDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-4 w-20 mb-6" />

        {/* Hero card */}
        <div className="rounded-3xl border border-surface-300 bg-surface-100 p-6 mb-6 space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-1.5">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Topic cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
