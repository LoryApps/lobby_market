import { BookOpen } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateArchiveLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <BookOpen className="h-5 w-5 text-gold" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg flex-shrink-0" />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg flex-shrink-0" />
          ))}
        </div>

        {/* Archive rows */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4"
            >
              <div className="flex items-start gap-3">
                {/* Win/loss icon */}
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-0.5" />

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Topic label */}
                  <Skeleton className="h-3 w-36" />
                  {/* Title */}
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  {/* Participants + date row */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {[0, 1].map((j) => (
                        <Skeleton key={j} className="h-6 w-6 rounded-full ring-2 ring-surface-100" />
                      ))}
                    </div>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
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
