import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-24 rounded" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-7 w-28 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
  )
}

export default function FluxLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex gap-2 mb-5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
