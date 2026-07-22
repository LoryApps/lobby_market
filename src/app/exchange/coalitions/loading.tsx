import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>

        {/* Coalition cards */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-7 w-7 rounded-full" />
              ))}
              <Skeleton className="h-4 w-20 ml-1" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
