import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentBattleLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24 md:pb-12 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>

        {/* Progress / bracket tracker */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          {/* Progress bar */}
          <Skeleton className="h-1.5 w-full rounded-full" />
          {/* Round pills */}
          <div className="flex items-center gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-5 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Round label divider */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-px flex-1" />
        </div>

        {/* Argument A card */}
        <div className="rounded-2xl bg-surface-100 border border-for-500/25 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* VS divider */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-200 border border-surface-300">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-4 w-5" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
        </div>

        {/* Argument B card */}
        <div className="rounded-2xl bg-surface-100 border border-against-500/25 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        {/* Instruction hint */}
        <Skeleton className="h-3 w-64 mx-auto" />
      </main>

      <BottomNav />
    </div>
  )
}
