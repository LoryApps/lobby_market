import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-300 bg-surface-200">
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="px-6 py-5 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <SkeletonText lines={4} />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
