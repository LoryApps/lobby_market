import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TranscriptLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Back link */}
        <Skeleton className="h-5 w-28 mb-6" />

        {/* Header card */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-8 space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-surface-300" />
          <Skeleton className="h-4 w-36" />
          <div className="h-px flex-1 bg-surface-300" />
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-32" />
        </div>

        {/* Argument list */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={
                i % 2 === 0
                  ? 'rounded-2xl border border-for-500/20 bg-for-500/5 p-5'
                  : 'rounded-2xl border border-against-500/20 bg-against-500/5 p-5'
              }
            >
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-12 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="pl-10 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
