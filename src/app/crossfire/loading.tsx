import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CrossfireLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-surface-300/50 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="p-4 flex gap-3">
              <div className="flex-1 space-y-2 rounded-xl border border-surface-300 p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex items-center justify-center w-8">
                <Skeleton className="h-4 w-6" />
              </div>
              <div className="flex-1 space-y-2 rounded-xl border border-surface-300 p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
