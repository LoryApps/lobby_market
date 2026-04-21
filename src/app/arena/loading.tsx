import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArenaLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0 animate-pulse">
            <div className="h-5 w-5 rounded bg-against-500/40" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Coalition search bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-10 rounded-xl" />
            </div>
          ))}
        </div>

        {/* Battle topics */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-28 mb-2" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
              </div>
              <div className="flex items-stretch divide-x divide-surface-300 rounded-xl overflow-hidden border border-surface-300">
                <div className="flex-1 bg-for-500/5 p-4 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-2 rounded-full" />
                </div>
                <div className="flex items-center justify-center px-4">
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                <div className="flex-1 bg-against-500/5 p-4 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-2 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
