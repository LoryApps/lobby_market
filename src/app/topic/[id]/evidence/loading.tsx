import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicEvidenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>

        {/* Topic header */}
        <div className="mb-8 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-full rounded" />
          <Skeleton className="h-5 w-4/5 rounded" />
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>

        {/* Evidence cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-14 rounded-full" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>
              <div className="pl-8 flex items-center justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-12 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
