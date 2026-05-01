import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MyArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>
        {/* Charts */}
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        {/* Arg list */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
