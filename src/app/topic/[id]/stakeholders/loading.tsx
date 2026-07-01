import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StakeholdersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 rounded-lg" />
          <Skeleton className="h-7 w-full rounded-lg" />
          <Skeleton className="h-7 w-3/4 rounded-lg" />
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
