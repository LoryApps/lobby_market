import { Mic } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateIndexLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Mic className="h-5 w-5 text-against-400" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg flex-shrink-0" />
          ))}
        </div>

        {/* Debate cards */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="space-y-3">
                {/* Topic link */}
                <Skeleton className="h-3 w-40" />

                {/* Title */}
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 2 }).map((__, j) => (
                      <Skeleton key={j} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-px" />
                  <Skeleton className="h-3 w-28" />
                </div>

                {/* Status + time row */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20 ml-auto" />
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
