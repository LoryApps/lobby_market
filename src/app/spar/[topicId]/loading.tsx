import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SparLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-24 md:pb-12">
        {/* Back button */}
        <div className="w-full max-w-lg mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        <div className="w-full max-w-lg space-y-6">
          {/* AI Sparring Partner header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-7 w-44" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-72 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>

          {/* Topic statement card */}
          <div className="w-full rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>

          {/* FOR / AGAINST picker */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-for-500/20 bg-for-500/5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-against-500/20 bg-against-500/5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>

          {/* Round pips */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-full" />
            ))}
          </div>

          <Skeleton className="h-3 w-56 mx-auto" />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
