import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicQualityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        {/* Tier badge */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex items-center gap-5">
          <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        {/* Grade distribution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
          <Skeleton className="h-4 w-32 mb-2" />
          <div className="flex items-end gap-2 h-20">
            {['A', 'B', 'C', 'D', 'F'].map((g, i) => (
              <div key={g} className="flex-1 flex flex-col items-center gap-1">
                <Skeleton className="w-full rounded-sm" style={{ height: `${[80, 55, 35, 20, 10][i]}%` }} />
                <Skeleton className="h-3 w-4" />
              </div>
            ))}
          </div>
        </div>
        {/* FOR vs AGAINST */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-4 w-16" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
