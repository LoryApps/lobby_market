import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function EditorialLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-pulse">
          <div className="space-y-4 border-b border-surface-300 pb-8">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-300" />
            <Skeleton className="h-3 w-32" />
            <div className="flex-1 h-px bg-surface-300" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
