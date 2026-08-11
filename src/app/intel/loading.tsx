import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 mb-3">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  )
}

function TopicRowSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
          <div className="flex items-center gap-2 mt-1">
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-4 w-4 flex-shrink-0 mt-0.5" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
    </div>
  )
}

function IntelSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section>
      <SectionHeaderSkeleton />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <TopicRowSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

export default function IntelLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-10">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-2 mt-3">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          <IntelSectionSkeleton rows={3} />
          <IntelSectionSkeleton rows={4} />
          <IntelSectionSkeleton rows={3} />
          <IntelSectionSkeleton rows={2} />
        </div>

        {/* Footer links */}
        <div className="pt-6 border-t border-surface-300 mt-8">
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-20" />
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
