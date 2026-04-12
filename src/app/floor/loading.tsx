import { Mic2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function FloorLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Mic2 className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Live indicator row */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>

        {/* Topic cards on the floor */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-start gap-3">
                {/* Rank badge */}
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Statement */}
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                  </div>

                  {/* Vote bar */}
                  <div className="space-y-1">
                    <Skeleton className="h-2.5 w-full rounded-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>

                  {/* Meta pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>

                {/* Quick vote buttons */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
