import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
