import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CrosswordLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-28 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="flex justify-center">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: 49 }).map((_, i) => (
              <Skeleton key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded-sm" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-12 rounded" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
