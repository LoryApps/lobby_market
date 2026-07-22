import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ScorecardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>

        {/* Overall grade */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center space-y-3">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-20 w-20 mx-auto rounded-2xl" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Dimension grades */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
