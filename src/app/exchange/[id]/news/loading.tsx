import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function NewsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-44" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            {i === 0 && <Skeleton className="h-36 w-full rounded-none" />}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
