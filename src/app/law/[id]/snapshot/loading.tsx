import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawSnapshotLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">
        {/* Back nav skeleton */}
        <Skeleton className="h-5 w-28" />

        {/* Established banner */}
        <Skeleton className="h-16 w-full rounded-2xl" />

        {/* Header */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>

        {/* Vote bar */}
        <div className="bg-surface-100 border border-surface-300/50 rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Arguments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
