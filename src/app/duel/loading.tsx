import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DuelLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        <div className="space-y-6 animate-pulse">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-7 w-4/5 mx-auto" />
            <Skeleton className="h-2 w-40 mx-auto rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 mx-auto" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
