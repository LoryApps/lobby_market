import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ParliamentLoading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pb-24 pt-6">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-7 w-56 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-2xl mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
        {/* Bodies grid */}
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => <Skeleton key={j} className="h-16 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
