import { Mic } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AMALeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <Skeleton className="h-4 w-24 mb-5" />
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Mic className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg flex-shrink-0" />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 0, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-2">
              <Skeleton className={`rounded-full ${i === 0 ? 'h-14 w-14' : 'h-11 w-11'}`} />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
              <Skeleton className="h-4 w-5 flex-shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-1 text-right flex-shrink-0">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
