import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ForecastLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-4">
        <Skeleton className="h-4 w-28" />
        {/* Topic meta */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        {/* Gauge */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4">
          <Skeleton className="h-40 w-40 rounded-full" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-2.5 w-64 rounded-full" />
        </div>
        {/* Signals */}
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-3 w-52" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
