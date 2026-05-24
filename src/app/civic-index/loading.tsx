import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3">
      <Skeleton className="h-2 w-2 rounded-full flex-shrink-0" />
      <Skeleton className="h-4 flex-1 max-w-sm" />
      <Skeleton className="hidden sm:block h-3 w-16" />
      <Skeleton className="hidden xs:block h-1.5 w-28 rounded-full" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  )
}

function SectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-4">
      <div className="sticky top-[56px] flex items-center gap-3 py-2 bg-surface-50">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="h-px flex-1 bg-surface-200" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="mt-1">
        {Array.from({ length: count }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export default function TopicIndexLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 mb-5">
          {[64, 48, 56, 52].map((w, i) => (
            <Skeleton key={i} className={`h-4 w-${w === 64 ? '16' : w === 48 ? '12' : w === 56 ? '14' : '13'}`} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Skeleton className="h-9 w-40 rounded-lg" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>

        {/* Letter nav */}
        <div className="flex items-center gap-1 flex-wrap mb-4 pb-3 border-b border-surface-200">
          {Array.from({ length: 26 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded" />
          ))}
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-1">
          <div className="w-2" />
          <Skeleton className="h-3 w-10 flex-1 max-w-[40px]" />
        </div>

        {/* Letter sections */}
        <SectionSkeleton count={5} />
        <SectionSkeleton count={3} />
        <SectionSkeleton count={7} />
        <SectionSkeleton count={4} />
      </main>
      <BottomNav />
    </div>
  )
}
