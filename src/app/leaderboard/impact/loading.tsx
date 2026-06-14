import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ImpactLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* Top 3 podium */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="flex items-end justify-center gap-3">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-14 w-20 rounded-t-lg" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-20 w-24 rounded-t-lg" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-10 w-20 rounded-t-lg" />
            </div>
          </div>
        </div>

        {/* Ranked list */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-6 w-6 rounded flex-shrink-0" />
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
