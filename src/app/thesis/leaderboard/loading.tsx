import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ThesisLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-xl mb-4" />
        <Skeleton className="h-10 w-full rounded-xl mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
