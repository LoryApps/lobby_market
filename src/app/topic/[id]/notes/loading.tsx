import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicNotesLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <div className="flex-1 overflow-hidden flex flex-col max-w-5xl mx-auto w-full px-4 py-6 gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </div>
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-64 flex flex-col gap-2">
            <Skeleton className="h-8 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
