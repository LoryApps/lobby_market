import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MythLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-56 mb-8" />
        <Skeleton className="h-48 w-full rounded-2xl mb-5" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
