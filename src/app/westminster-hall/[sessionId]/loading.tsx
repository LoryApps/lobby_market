import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SessionDetailLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28 md:pb-12">
        {/* Back nav */}
        <Skeleton className="h-4 w-32 mt-2 mb-5" />

        {/* Session header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-6 w-4/5" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex items-center gap-4 pt-3 border-t border-surface-200">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Related topic */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-5">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>

        {/* Speeches heading */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>

        {/* Speech bubbles */}
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  {i % 2 === 0 && <Skeleton className="h-3.5 w-3/4" />}
                </div>
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
