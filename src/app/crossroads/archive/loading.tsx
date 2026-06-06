import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CrossroadsArchiveLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>

        {/* Season filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Archive entries */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-4 space-y-3">
            {/* Issue header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>

            <div className="border-t border-surface-300 pt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            {/* Match participants */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <div className="flex items-center gap-1 mx-2">
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              </div>
            </div>

            {/* Result bar */}
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
