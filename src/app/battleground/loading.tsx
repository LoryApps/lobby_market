import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function BattlegroundLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-24 md:pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-5 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="rounded-2xl h-64" />
          <Skeleton className="rounded-2xl h-64" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
