import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function VelocityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-4 w-24 mb-4 rounded" />
          <Skeleton className="h-8 w-56 mb-2 rounded" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        <div className="flex gap-2 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
              <Skeleton className="h-11 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
