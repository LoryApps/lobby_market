import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NightLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Masthead */}
        <div className="border-b border-surface-300 pb-5 mb-6">
          <div className="flex justify-between mb-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex items-center gap-3 mb-1">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-3 w-64 mt-2" />
        </div>

        {/* Pulse row */}
        <div className="flex gap-5 mb-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>

        {/* Contested card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        <div className="border-t border-surface-300 my-6" />

        {/* Night owl list */}
        <Skeleton className="h-3 w-40 mb-3" />
        <div className="space-y-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-32" />
              </div>
              <Skeleton className="h-2 w-14 flex-shrink-0" />
            </div>
          ))}
        </div>

        <div className="border-t border-surface-300 my-6" />

        {/* Sleepers grid */}
        <Skeleton className="h-3 w-44 mb-3" />
        <div className="grid grid-cols-2 gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1.5">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="border-t border-surface-300 my-6" />
        <Skeleton className="h-3 w-32 mb-3" />
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
