import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MyDebateRecordLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-6 w-14 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
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
