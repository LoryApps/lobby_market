import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function HeroCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Skeleton className="h-4 w-4 rounded flex-shrink-0 mt-1" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-200/50">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function ArgumentCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 ${tall ? 'pb-6' : ''}`}>
      {/* Side badge */}
      <Skeleton className="h-5 w-16 rounded-full" />
      {/* Quote */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        {tall && <Skeleton className="h-4 w-3/4" />}
      </div>
      {/* Topic chip */}
      <Skeleton className="h-8 w-full rounded-xl" />
      {/* Author + upvotes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
    </div>
  )
}

export default function GalleryLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
          ))}
          <div className="ml-auto flex gap-2 flex-shrink-0">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>

        {/* Hero trio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <HeroCardSkeleton key={i} />
          ))}
        </div>

        {/* Section heading */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Masonry grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[false, true, false, false, true, false, true, false, false].map((tall, i) => (
            <ArgumentCardSkeleton key={i} tall={tall} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
