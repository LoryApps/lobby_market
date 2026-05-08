import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ShareLawLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-6">
        {/* Law card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-full rounded" />
          <Skeleton className="h-7 w-3/4 rounded" />

          {/* Vote bar */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>

          {/* Stats row */}
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Top arguments */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>

        {/* Share panel */}
        <Skeleton className="h-12 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
