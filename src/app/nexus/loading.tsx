import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function NexusLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>

        {/* Filter/sort row */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full ml-auto" />
        </div>

        {/* Nexus topic cards */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-200 animate-pulse flex items-center justify-center">
                <Skeleton className="h-5 w-5 rounded" />
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
            </div>
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
            {/* Connection count bar */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
