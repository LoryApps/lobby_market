import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function PressureLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl mb-4" />
        <Skeleton className="h-36 rounded-2xl mb-4" />
        <Skeleton className="h-40 rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
