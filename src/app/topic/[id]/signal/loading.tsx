import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SignalLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-5 w-20 rounded-full mb-2" />
        <Skeleton className="h-7 w-full mb-1" />
        <Skeleton className="h-7 w-3/4 mb-6" />
        <Skeleton className="h-24 rounded-2xl mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
