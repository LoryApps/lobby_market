import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BriefLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-28 md:pb-14">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* Statement */}
        <div className="space-y-2 mb-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-3/4" />
        </div>

        {/* Vote bar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-8 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Context section */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Arguments */}
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-1.5 py-3 border-b border-surface-300 last:border-0">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <div className="flex items-center gap-2 mt-1">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
