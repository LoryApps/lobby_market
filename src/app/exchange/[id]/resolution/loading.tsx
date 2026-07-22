import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ResolutionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>

        {/* Resolution criteria */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-surface-300/30">
              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Timeline to resolution */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between pt-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>

        {/* Historical resolutions */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-surface-300/30">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
