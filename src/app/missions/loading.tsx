import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MissionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-8 w-56" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
                <Skeleton className="h-6 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 flex items-start gap-4">
              <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-2 w-12" />
                    <Skeleton className="h-2 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
