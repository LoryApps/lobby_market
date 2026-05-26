import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SeismicLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-96" />
          <div className="flex gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-32 rounded-xl" />
            ))}
          </div>
        </div>
        {[1, 2, 3].map((section) => (
          <div key={section} className="mb-8">
            <Skeleton className="h-6 w-40 mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
