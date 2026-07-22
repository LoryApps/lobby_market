import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SignalLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Composite signal */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Signal components */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
