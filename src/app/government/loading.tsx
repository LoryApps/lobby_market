import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GovernmentLoading() {
  return (
    <div className="min-h-screen bg-surface-0 text-white">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
