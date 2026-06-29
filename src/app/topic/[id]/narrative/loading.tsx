import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function NarrativeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="mb-6 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-3/4" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
