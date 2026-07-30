import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 space-y-4 p-4">
        <Skeleton className="h-5 w-44" />
        <div className="flex justify-center py-4">
          <Skeleton className="w-36 h-36 rounded-full" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
