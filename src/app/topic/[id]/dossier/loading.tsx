import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DossierLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
        </div>

        {/* Vote bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Arguments */}
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex gap-2">
                  <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
