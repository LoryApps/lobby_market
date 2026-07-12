import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DailyBriefLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6">
          <Skeleton className="h-8 w-52 rounded-lg mb-2" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="flex-1 h-20 rounded-xl" />
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
