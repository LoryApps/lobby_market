import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ReplayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-6 w-32" />
        </div>

        {/* Topic header */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>

        {/* Playback controls */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-4">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          {/* Vote bar snapshot */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>

        {/* Timeline events */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-1">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="relative pl-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 mb-5 last:mb-0">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-3 w-3 rounded-full flex-shrink-0 mt-1" />
                  {i < 5 && <div className="w-px flex-1 bg-surface-300/50 mt-1" />}
                </div>
                <div className="flex-1 pb-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
