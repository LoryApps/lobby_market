import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TenMinuteRuleLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
