import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GazetteLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 space-y-6">
        {/* Masthead */}
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-52 mx-auto" />
          <Skeleton className="h-3.5 w-72 mx-auto" />
          <div className="flex flex-col gap-0.5 mt-3">
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-px w-full" />
          </div>
        </div>

        {/* Nav */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>

        {/* Law */}
        <Skeleton className="h-32 rounded-2xl" />

        {/* Debate */}
        <Skeleton className="h-32 rounded-2xl" />

        {/* Argument */}
        <Skeleton className="h-44 rounded-2xl" />

        {/* Topics */}
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
