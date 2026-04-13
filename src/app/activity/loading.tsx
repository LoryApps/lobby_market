import { Activity } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ActivityLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 flex-shrink-0">
              <Activity className="h-4 w-4 text-surface-500" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 ml-auto" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
            >
              <Skeleton className="h-2.5 w-16 mb-2" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <Skeleton className="h-10 w-full rounded-xl mb-6" />

        {/* Timeline groups */}
        {[1, 2].map((g) => (
          <div key={g} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-3 w-14" />
              <div className="flex-1 h-px bg-surface-300" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: g === 1 ? 4 : 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 pl-10 relative">
                  <Skeleton className="absolute left-0 h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex items-center gap-2 pt-0.5">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-4 w-18 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
