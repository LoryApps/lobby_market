import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BiasCheckLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-5">
          <div className="flex items-center gap-6">
            <Skeleton className="h-36 w-36 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-36 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-5 space-y-4">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-28 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
