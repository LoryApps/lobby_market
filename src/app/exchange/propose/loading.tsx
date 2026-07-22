import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProposeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>

        {/* Guidelines */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0 mt-0.5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>

        <Skeleton className="h-12 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
