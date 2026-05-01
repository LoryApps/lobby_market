import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function GameTileSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      {/* Icon + title */}
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      {/* CTA button */}
      <Skeleton className="h-9 w-full rounded-xl mt-1" />
    </div>
  )
}

export default function ArcadeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Today's streak / stats bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton className="h-6 w-10 mx-auto" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily challenges section */}
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20 ml-auto rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <GameTileSkeleton key={i} />
          ))}
        </div>

        {/* All games section */}
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <GameTileSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
