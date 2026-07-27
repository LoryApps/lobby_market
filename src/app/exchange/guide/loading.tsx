import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function GuideLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Skeleton className="h-4 w-20 mb-4" />
        </div>
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Section blocks */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}
