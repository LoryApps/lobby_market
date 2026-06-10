import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-8 pb-28 space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-7 w-full max-w-sm" />
          <Skeleton className="h-4 w-48" />
        </div>
        {/* Verdict banner */}
        <Skeleton className="h-36 w-full rounded-2xl" />
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Speaker cards */}
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        {/* Nav */}
        <Skeleton className="h-56 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
