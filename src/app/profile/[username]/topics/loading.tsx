import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProfileTopicsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Back link */}
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <Skeleton className="h-6 w-10 mb-1" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Topic list */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
              </div>
              <Skeleton className="h-2 w-full rounded-full mb-2" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
