import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ThesisBattleLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>

        {/* VS layout */}
        <div className="space-y-4">
          {[0, 1].map((side) => (
            <div
              key={side}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-surface-300" />
            <Skeleton className="h-7 w-10 rounded-full" />
            <div className="flex-1 h-px bg-surface-300" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
