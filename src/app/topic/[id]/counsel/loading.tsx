import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CounselLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <div className="border-b border-surface-300 bg-surface-100 px-4 py-2.5">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="bg-surface-100 border-b border-surface-300 px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
      <div className="border-t border-surface-300 bg-surface-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Skeleton className="flex-1 h-11 rounded-2xl" />
          <Skeleton className="h-11 w-11 rounded-2xl flex-shrink-0" />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
