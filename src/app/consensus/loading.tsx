import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ConsensusLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col overflow-hidden px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-6 w-full max-w-xs mb-3" />
        <Skeleton className="flex-1 rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
