import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SerendipityLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-950">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300 bg-surface-200/50">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
