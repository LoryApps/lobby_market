import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CalculatorLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Input card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Results */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-50 border border-surface-300/60 p-4 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
