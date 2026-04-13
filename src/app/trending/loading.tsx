import { Flame } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TrendingLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <Flame className="h-5 w-5 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3.5 w-52" />
          </div>
        </div>

        {/* Pulse stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Hot Topics */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300">
                    <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-1 w-full rounded-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-16 rounded" />
                        <Skeleton className="h-4 w-14 rounded" />
                        <Skeleton className="h-4 w-20 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0 space-y-6">
            {/* Laws */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Debates */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
                    <Skeleton className="h-4 w-4 flex-shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
