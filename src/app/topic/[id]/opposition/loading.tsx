import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function OppositionLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 pb-24 pt-2 max-w-2xl mx-auto w-full px-4">
        <Skeleton className="h-4 w-28 rounded mb-4" />
        <Skeleton className="h-6 w-48 rounded mb-4" />
        <Skeleton className="h-28 rounded-xl mb-4" />
        <div className="flex gap-2 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg flex-shrink-0" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
