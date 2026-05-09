import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GauntletLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 gap-6">
        <Skeleton className="h-20 w-20 rounded-3xl" />
        <Skeleton className="h-8 w-48" />
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
