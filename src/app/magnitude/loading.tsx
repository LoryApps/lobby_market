import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MagnitudeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3.5 w-60" />
          </div>
        </div>

        {/* Magnitude class tabs */}
        <div className="flex gap-2 mb-6">
          {['M8+', 'M6–7', 'M4–5', 'M2–3'].map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>

        {/* Richter-scale topic cards */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-3 space-y-3">
            <div className="flex items-center gap-3">
              {/* Magnitude badge */}
              <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
            </div>
            {/* Magnitude meter */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
                <Skeleton className={`h-full rounded-full`} style={{ width: `${60 + i * 5}%` }} />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
