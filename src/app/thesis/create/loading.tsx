import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CreateThesisLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>

        <div className="space-y-5 animate-pulse">
          {/* Prediction text */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-20" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          {/* Confidence */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

          {/* Submit */}
          <Skeleton className="h-12 w-full rounded-xl mt-6" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
