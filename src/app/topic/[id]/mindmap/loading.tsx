import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-8">
        <div className="flex items-start gap-3 mb-5">
          <Skeleton className="h-8 w-8 rounded-lg mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <Skeleton className="rounded-2xl" style={{ minHeight: '520px', display: 'block' }} />
      </main>
      <BottomNav />
    </div>
  )
}
