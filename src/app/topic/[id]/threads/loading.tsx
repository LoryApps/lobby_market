import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ThreadsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg" />
          ))}
        </div>

        {/* Thread cards */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              {/* Argument author */}
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              {/* Argument text */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              {/* Reply count row */}
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              {/* Reply previews */}
              <div className="space-y-2 pl-4 border-l-2 border-surface-400/40">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex gap-2 items-start">
                    <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
