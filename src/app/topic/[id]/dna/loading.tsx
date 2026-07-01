import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DNALoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-lg" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded-lg" />
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <Skeleton key={k} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
