import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawAuditLoading() {
  return (
    <>
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 flex flex-col items-center gap-4">
            <Skeleton className="h-40 w-40 rounded-full" />
            <Skeleton className="h-5 w-64" />
            <div className="flex gap-8">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
