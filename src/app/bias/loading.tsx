import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BiasLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>

        {/* Overall score card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-3">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-52" />
          <div className="flex gap-6 mt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Bias cards */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
