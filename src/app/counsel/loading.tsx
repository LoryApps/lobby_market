import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CounselLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 pb-24 md:pb-10 gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-surface-200 border border-surface-300 flex-shrink-0">
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Suggested questions */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-32 mb-3" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <Skeleton className="h-3.5 flex-1" style={{ width: `${60 + i * 7}%` }} />
            </div>
          ))}
        </div>

        {/* Chat area placeholder */}
        <div className="flex-1 min-h-[200px] rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="flex-1 max-w-xs space-y-2">
              <Skeleton className="h-4 w-full ml-auto" />
              <Skeleton className="h-4 w-2/3 ml-auto" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-5 flex-1 rounded" />
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
