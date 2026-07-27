import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RelayScorecardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Relay title */}
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-6" />

        {/* Overall score card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-6 text-center">
          <Skeleton className="h-20 w-20 rounded-2xl mx-auto mb-3" />
          <Skeleton className="h-5 w-32 mx-auto mb-1" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>

        {/* Participant scores */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
