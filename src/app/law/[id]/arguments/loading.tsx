import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function ArgumentSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-8 rounded" />
        </div>
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export default function LawArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <Skeleton className="h-5 w-28 mb-5" />

        {/* Law header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-4 w-72 mb-5" />

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <div className="flex gap-1 ml-auto">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>

        {/* Argument cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ArgumentSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
