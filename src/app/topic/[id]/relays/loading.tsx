import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicRelaysLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-44" />
          </div>
        </div>

        {/* Filter strip */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg flex-shrink-0" />
          ))}
        </div>

        {/* Create button */}
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Relay chain cards */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              {/* Chain header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>

              {/* Legs */}
              <div className="space-y-2 pl-4 border-l-2 border-surface-300">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                      <Skeleton className="h-3 w-20" />
                      <div className="ml-auto">
                        <Skeleton className="h-5 w-10 rounded" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full ml-8" />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <div className="ml-auto">
                  <Skeleton className="h-8 w-28 rounded-lg" />
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
