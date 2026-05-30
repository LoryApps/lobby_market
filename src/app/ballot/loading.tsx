import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BallotLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-20 pb-28">
        <div className="mt-8 space-y-6">
          <Skeleton className="h-5 w-40 mx-auto" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            <div className="h-1 bg-surface-300" />
            <div className="p-6 space-y-5">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="flex-1 h-16 rounded-xl" />
                <Skeleton className="flex-1 h-16 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
