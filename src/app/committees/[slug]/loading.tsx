import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CommitteeDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <div className="border-b border-surface-300/50 bg-surface-100/80">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Skeleton className="h-4 w-32 mb-5" />
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40 mt-2" />
            </div>
          </div>
        </div>
      </div>
      <main className="flex-1 pb-20">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
