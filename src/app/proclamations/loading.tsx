import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ProclamationsLoading() {
  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        <div className="border-b border-surface-300/40 bg-surface-50">
          <div className="mx-auto max-w-2xl px-4 py-8">
            <Skeleton className="h-3.5 w-28 mb-6" />
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="h-4 w-3/4 max-w-xs" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-6">
              <Skeleton className="h-12 w-16" />
              <Skeleton className="h-8 w-px" />
              <Skeleton className="h-12 w-16" />
              <Skeleton className="h-8 w-px" />
              <Skeleton className="h-12 w-16" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
          <div className="flex gap-1 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300/50 bg-surface-100 p-5 space-y-4 animate-pulse">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-2/3" />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
