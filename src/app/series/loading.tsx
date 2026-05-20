import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SeriesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
