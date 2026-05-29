import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-200 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  )
}

export default function ExpertsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-32 rounded-3xl mb-6" />
        <Skeleton className="h-10 rounded-xl mb-6" />
        <div className="grid gap-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
