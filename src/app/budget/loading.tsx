import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BudgetLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
