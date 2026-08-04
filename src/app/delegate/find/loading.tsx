import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FindDelegateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-68" />
        </div>
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
