import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function EveningLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Masthead skeleton */}
        <div className="border-b border-surface-300 pb-5 mb-6">
          <div className="flex justify-between mb-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-10 w-56 mt-2" />
          <Skeleton className="h-3 w-72 mt-2" />
        </div>

        {/* Pulse row */}
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Verdicts */}
        <div className="mb-3">
          <Skeleton className="h-3 w-20 mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 mb-2">
              <Skeleton className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2 w-32" />
              </div>
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Two column */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 my-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-3 w-28 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Top argument */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3 mb-6">
          <div className="flex gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-8 ml-auto" />
          </div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
