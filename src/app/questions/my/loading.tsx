import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MyQALoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-60" />
        </div>
        {/* Tab strip */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        {/* Q&A items */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
