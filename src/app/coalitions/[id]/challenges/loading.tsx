import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CoalitionChallengesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>

        {/* Info card */}
        <div className="mb-5 rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Skeleton className="h-11 w-full rounded-xl mb-4" />

        {/* Challenge cards */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mb-3 rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-14 flex-1 rounded-xl" />
              <Skeleton className="h-14 w-8 rounded" />
              <Skeleton className="h-14 flex-1 rounded-xl" />
            </div>
            <div className="flex gap-2 justify-end">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
