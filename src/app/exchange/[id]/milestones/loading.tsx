import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MilestonesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>

        {/* Progress toward settlement */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Timeline */}
        <div className="relative pl-6 space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="absolute left-0 flex flex-col items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <div className="ml-4 rounded-xl bg-surface-100 border border-surface-300 p-4 flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
