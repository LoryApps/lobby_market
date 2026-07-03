import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CivicNominationsLoading() {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 md:pb-8">
        <Skeleton className="h-4 w-32 rounded mb-6" />
        <Skeleton className="h-12 w-full rounded-xl mb-6" />
        <div className="grid grid-cols-5 gap-1.5 mb-6">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
        <div className="flex gap-2 mb-5">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-16 rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
