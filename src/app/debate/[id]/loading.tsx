import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
        </div>

        {/* Topic banner */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5 flex items-start gap-3">
          <Skeleton className="h-5 w-5 rounded flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Two-sided arena */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* FOR side */}
          <div className="rounded-2xl bg-for-500/5 border border-for-500/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full bg-for-500/30" />
              <Skeleton className="h-4 w-16 bg-for-500/20" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>

          {/* AGAINST side */}
          <div className="rounded-2xl bg-against-500/5 border border-against-500/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full bg-against-500/30" />
              <Skeleton className="h-4 w-20 bg-against-500/20" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-5 flex items-center justify-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-px bg-surface-400" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Chat / messages */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="p-4 border-b border-surface-300 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}
              >
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div
                  className={`flex-1 max-w-[72%] space-y-1.5 ${
                    i % 2 === 0 ? '' : 'items-end flex flex-col'
                  }`}
                >
                  <Skeleton className="h-3 w-24" />
                  <div
                    className={`rounded-2xl p-3 space-y-1.5 ${
                      i % 2 === 0
                        ? 'bg-surface-200 rounded-tl-sm'
                        : 'bg-for-500/10 rounded-tr-sm w-full'
                    }`}
                  >
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input skeleton */}
          <div className="p-4 border-t border-surface-300 flex items-center gap-3">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
