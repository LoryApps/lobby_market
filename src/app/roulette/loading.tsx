import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RouletteLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}
