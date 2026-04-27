import { BarChart2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PulseReactionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
            <BarChart2 className="h-5 w-5 text-against-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-60" />
          </div>
        </div>

        {/* Reaction cards */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              {/* Topic header */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>

              {/* Reaction emoji row */}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-1.5 rounded-full bg-surface-200 border border-surface-300 px-3 py-1">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
