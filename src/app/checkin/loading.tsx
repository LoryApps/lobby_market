import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CheckinLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-10 pb-24 md:pb-12 space-y-6">
        {/* Streak badge */}
        <div className="flex justify-center">
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>

        {/* Topic card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-14 flex-1 rounded-xl" />
            <Skeleton className="h-14 flex-1 rounded-xl" />
          </div>
        </div>

        {/* Vote bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Activity grid */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-6 rounded-sm" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
