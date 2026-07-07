import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SentimentLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-6 w-44" />
        </div>

        {/* Topic header */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>

        {/* Discourse health score */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-200/50 p-3 text-center space-y-1">
                <Skeleton className="h-6 w-10 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Emotion breakdown chart */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20 flex-shrink-0" />
              <div className="flex-1">
                <Skeleton
                  className="h-5 rounded-full"
                  style={{ width: `${85 - i * 12}%` }}
                />
              </div>
              <Skeleton className="h-4 w-8 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Sample arguments */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-200/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-16 rounded-full ml-auto" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
