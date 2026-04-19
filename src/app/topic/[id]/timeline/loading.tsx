import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicTimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <Skeleton className="h-4 w-32 mb-6 rounded" />
        <Skeleton className="h-6 w-full mb-1 rounded" />
        <Skeleton className="h-6 w-3/4 mb-6 rounded" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <Skeleton className="h-3 w-16 mb-2 rounded" />
              <Skeleton className="h-7 w-20 rounded" />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5 mb-6">
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5 mb-6">
          <Skeleton className="h-16 w-full rounded" />
        </div>

        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 pl-10">
              <Skeleton className="absolute left-0 h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
