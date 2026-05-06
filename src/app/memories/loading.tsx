import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MemoriesLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
