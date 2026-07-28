import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14 space-y-4">
        <Skeleton className="h-4 w-32 mb-6" />

        {/* Clash card header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-3/4" />

          {/* Speakers */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Best arguments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
