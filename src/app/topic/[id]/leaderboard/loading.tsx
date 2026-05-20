import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Trophy } from 'lucide-react'

export default function TopicLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-24 pt-4">
        <Skeleton className="h-4 w-24 mb-4" />

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-gold" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
          <div className="flex gap-4 mt-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-18" />
          </div>
        </div>

        <Skeleton className="h-11 w-full rounded-xl mb-4" />

        <div className="bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden">
          <Skeleton className="h-9 w-full rounded-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-surface-300/30">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-4 w-10 ml-auto" />
                <Skeleton className="h-2.5 w-12 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
