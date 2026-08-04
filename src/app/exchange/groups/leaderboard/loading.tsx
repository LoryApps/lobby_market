import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GroupsLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* Podium */}
        <div className="flex items-end justify-center gap-3 mb-6">
          <Skeleton className="h-20 w-24 rounded-xl" />
          <Skeleton className="h-28 w-24 rounded-xl" />
          <Skeleton className="h-16 w-24 rounded-xl" />
        </div>
        {/* List */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
