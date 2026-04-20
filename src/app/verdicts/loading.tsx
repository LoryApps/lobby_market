import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function VerdictsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          {[80, 100, 72].map((w, i) => (
            <Skeleton key={i} className={`h-9 w-${w === 80 ? '20' : w === 100 ? '28' : '16'} rounded-lg`} />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-4/5 rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
