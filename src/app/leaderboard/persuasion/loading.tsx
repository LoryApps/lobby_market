import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PersuasionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
