import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function VoteTrendLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        <Skeleton className="h-5 w-36 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-7 w-full rounded-lg" />
          <Skeleton className="h-7 w-2/3 rounded-lg" />
        </div>
        {/* stat pills */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
        {/* chart */}
        <Skeleton className="h-72 w-full rounded-2xl" />
        {/* milestones */}
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
