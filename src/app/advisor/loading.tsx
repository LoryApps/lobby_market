import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AdvisorLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-3 space-y-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
