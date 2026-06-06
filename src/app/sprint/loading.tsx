import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SprintLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Progress header */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Round indicator */}
        <div className="text-center mb-6">
          <Skeleton className="h-4 w-24 mx-auto mb-2" />
          <Skeleton className="h-7 w-32 mx-auto" />
        </div>

        {/* Topic card */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6 mb-5 space-y-4">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-4/5" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>

        {/* Score display */}
        <div className="flex justify-center gap-4 mt-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-3 rounded-full" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
