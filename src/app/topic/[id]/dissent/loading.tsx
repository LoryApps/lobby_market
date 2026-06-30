import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DissentLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-3 w-32 mb-4" />
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-28 mb-3" />
            <Skeleton className="h-5 w-full mb-2" />
            <Skeleton className="h-5 w-3/4 mb-4" />
            <Skeleton className="h-3 w-full mb-1.5" />
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-7 w-12 mx-auto mb-1" />
                  <Skeleton className="h-2 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex gap-3 mb-3">
                <Skeleton className="h-3 w-5 rounded" />
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-24 mb-1" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-5/6 mb-1" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
