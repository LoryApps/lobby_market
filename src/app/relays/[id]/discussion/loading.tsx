import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-24 mb-5" />
        <Skeleton className="h-36 w-full rounded-2xl mb-5" />
        <Skeleton className="h-6 w-32 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 mb-5">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
