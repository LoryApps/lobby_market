import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArenaChampionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pt-16 pb-24 px-4 max-w-2xl mx-auto w-full">
        <div className="py-6 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-surface-300" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-28 bg-surface-300 rounded" />
                  <div className="h-2.5 w-20 bg-surface-300 rounded" />
                </div>
                <div className="h-5 w-14 bg-surface-300 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-surface-300 rounded" />
                <div className="h-3.5 w-5/6 bg-surface-300 rounded" />
                <div className="h-3.5 w-4/6 bg-surface-300 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-surface-300 rounded-full" />
                <div className="h-3 w-10 bg-surface-300 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
