import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ReportCardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Overall grade card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5 flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Subject grade cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-10 mb-2" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2.5 w-24 mt-1.5" />
            </div>
          ))}
        </div>

        {/* Commentary section */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>

        {/* Share button */}
        <Skeleton className="h-11 w-36 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
