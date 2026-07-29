import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ContrarianLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Score card skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-surface-200 rounded-xl p-4">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Section skeleton */}
        {[0, 1].map((s) => (
          <div key={s} className="mb-6">
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5 mb-3" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-1.5 flex-1 rounded-full" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
