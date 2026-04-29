import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function JudgeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-6 w-44 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-10 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mb-6" />
        <Skeleton className="h-28 rounded-2xl mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
