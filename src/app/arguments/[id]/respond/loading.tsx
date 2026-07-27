import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ArgumentRespondLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <Skeleton className="h-4 w-28 mb-6" />

        {/* Original argument card */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-full mb-1.5" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Response composer */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-32 w-full rounded-lg mb-4" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
