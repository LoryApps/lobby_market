import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function VoicesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-7 w-36 rounded" />
          </div>
          <Skeleton className="h-4 w-72 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-1.5 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-lg flex-shrink-0" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4 rounded-2xl border border-surface-300/60 bg-surface-100">
              <Skeleton className="h-4 w-7 rounded mt-1" />
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
