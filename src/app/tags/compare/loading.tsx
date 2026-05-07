import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TagCompareLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 p-4 rounded-xl border border-surface-300">
              <Skeleton className="h-6 w-20" />
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-14 rounded-lg" />)}
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-28 rounded-xl mb-6" />
      </main>
      <BottomNav />
    </div>
  )
}
