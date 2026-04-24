import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CompareUsersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* User selectors */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="rounded-xl bg-surface-200 p-3 space-y-1">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Shared topics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-36" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-4 animate-pulse"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Skeleton className="h-6 w-10 rounded" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-10 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
