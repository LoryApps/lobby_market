import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function EvidenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-2.5 w-14 mb-2" />
              <Skeleton className="h-7 w-10 mb-1" />
              <Skeleton className="h-2 w-16" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
          <Skeleton className="h-2.5 w-28 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-2 w-14" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-2">
          <Skeleton className="h-2.5 w-28 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-2 w-8" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              </div>
              <Skeleton className="h-3 w-3/4 mt-3" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
