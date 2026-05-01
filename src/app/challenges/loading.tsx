import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function ChallengeSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Topic */}
      <div className="px-4 pb-3">
        <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-3 space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      </div>
      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-200/50 flex items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function ChallengesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-xl flex-shrink-0" />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-surface-200/50 rounded-xl mb-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1 text-center">
              <Skeleton className="h-7 w-10 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Challenge cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <ChallengeSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
