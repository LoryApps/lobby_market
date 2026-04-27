import { Calendar } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LeaderboardWeekLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Calendar className="h-5 w-5 text-gold" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-3 mb-8">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-16 w-24 rounded-t-xl" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-24 w-24 rounded-t-xl" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-12 w-24 rounded-t-xl" />
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-22 rounded-xl" />
        </div>

        {/* Rank list */}
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
