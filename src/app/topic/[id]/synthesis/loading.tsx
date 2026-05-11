import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicSynthesisLoading() {
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
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-52 rounded" />
          </div>
        </div>

        {/* Synthesis panel skeleton */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-40 rounded" />
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-surface-300">
            {/* Common ground block */}
            <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3.5 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
            </div>
            {/* Tensions block */}
            <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-3.5 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>
            {/* Synthesis block */}
            <div className="rounded-xl bg-purple/5 border border-purple/20 p-3.5 space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
        </div>

        {/* Explainer cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
