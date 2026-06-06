import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TrendsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          {/* Window selector */}
          <Skeleton className="h-9 w-full rounded-xl" />
          {/* Tab selector */}
          <Skeleton className="h-8 w-full rounded-lg" />
          {/* Content rows */}
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 bg-surface-100/30"
              >
                <Skeleton className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2 w-full mt-1" />
                </div>
                <Skeleton className="w-12 h-4 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
