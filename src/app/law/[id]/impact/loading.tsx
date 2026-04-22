import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawImpactLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-4">
        {/* Back + breadcrumb */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Law header */}
        <Skeleton className="h-28 rounded-2xl" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        {/* Vote breakdown */}
        <Skeleton className="h-24 rounded-2xl" />

        {/* Timeline */}
        <Skeleton className="h-48 rounded-2xl" />

        {/* Arguments */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
