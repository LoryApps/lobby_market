import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebatesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-px bg-surface-400" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
