import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicThemesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>

        {/* Topic header */}
        <div className="mb-6 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-4 w-8 ml-auto" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center space-y-1">
              <Skeleton className="h-6 w-8 mx-auto" />
              <Skeleton className="h-2.5 w-20 mx-auto" />
            </div>
          ))}
        </div>

        {/* Distribution bar */}
        <div className="mb-5 rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2.5">
          <Skeleton className="h-3 w-36" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-28 flex-shrink-0" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>

        {/* Theme cards */}
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
