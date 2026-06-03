import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ElectionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-20">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-8 h-4 w-72" />
        {[1, 2].map((i) => (
          <div key={i} className="mb-6 rounded-xl border border-surface-300 bg-surface-100 p-5">
            <Skeleton className="mb-3 h-5 w-56" />
            <Skeleton className="mb-6 h-4 w-full" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="mb-3 flex items-center gap-3 rounded-lg bg-surface-200 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
