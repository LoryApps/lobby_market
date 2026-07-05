import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AMALoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>

        {/* Session cards */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
