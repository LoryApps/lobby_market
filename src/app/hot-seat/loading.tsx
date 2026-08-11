import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function HotSeatLoading() {
  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 pt-20">

        {/* Header */}
        <div className="text-center space-y-2 pt-6 pb-5">
          <div className="flex items-center justify-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-7 w-40" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>

        {/* Info blurb */}
        <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-4 py-3 mb-5 flex items-start gap-3">
          <Skeleton className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>

        {/* Topic card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-200/80 p-5 space-y-4 mb-4">
          {/* Category + badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>

          {/* Statement */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/5" />
          </div>

          {/* Vote bar */}
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>

          {/* Divisiveness note */}
          <div className="flex justify-center">
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* FOR argument card */}
        <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-4 space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* AGAINST argument card */}
        <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-4 space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Locked vote button */}
        <div className="rounded-2xl border border-surface-300 bg-surface-200/40 p-5 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
