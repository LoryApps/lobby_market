import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FramesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-6 w-24 mb-2" />
        <Skeleton className="h-7 w-full mb-1" />
        <Skeleton className="h-7 w-3/4 mb-3" />
        <Skeleton className="h-2 w-full rounded-full mb-4" />
        <Skeleton className="h-24 w-full rounded-xl mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/20 p-4 space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
