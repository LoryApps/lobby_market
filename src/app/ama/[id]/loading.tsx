import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AMASessionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 md:pb-12">
        {/* Session header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>

        {/* Submit question area */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Sort/filter controls */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        {/* Question cards */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-8 w-12 rounded-lg flex-shrink-0" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
