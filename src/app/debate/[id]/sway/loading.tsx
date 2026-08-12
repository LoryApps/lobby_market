import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SwayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-5">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300/40 p-4">
          <Skeleton className="h-[160px] w-full rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}
