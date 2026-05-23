import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MomentumLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-24 mb-5" />
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
              <div className="flex justify-between items-start">
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-9 w-16" />
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
