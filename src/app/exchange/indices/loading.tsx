import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function IndicesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Index cards */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="text-right space-y-1.5">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
