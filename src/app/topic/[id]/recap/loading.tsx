import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicRecapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">
        {/* Back nav */}
        <Skeleton className="h-4 w-32" />

        {/* Verdict banner */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-1.5">
                <Skeleton className="h-8 w-8 rounded-lg mx-auto" />
                <Skeleton className="h-5 w-12 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Resolution details */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>

        {/* Arguments */}
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1].map((side) => (
              <div key={side} className="space-y-2.5">
                <Skeleton className="h-4 w-24" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3.5 w-3/5" />
                    <div className="flex items-center gap-2 mt-1">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-8 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
