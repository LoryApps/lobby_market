import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawHealthLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        <Skeleton className="h-4 w-28 rounded mb-6" />
        <div className="space-y-3 mb-8">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </div>
        {/* Health score card */}
        <Skeleton className="h-36 w-full rounded-2xl mb-4" />
        {/* Dimension cards */}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl mb-3" />
        ))}
        <Skeleton className="h-32 w-full rounded-2xl mt-6" />
      </main>
      <BottomNav />
    </div>
  )
}
