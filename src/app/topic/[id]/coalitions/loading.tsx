import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-900 text-white">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        <Skeleton className="h-4 w-24 mb-5" />
        <div className="mb-6">
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl mb-4" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
