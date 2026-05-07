import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TagsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center space-y-1.5">
              <Skeleton className="h-6 w-10 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tag cloud skeleton — varying widths to simulate real content */}
        <div className="flex flex-wrap gap-2">
          {[28, 20, 36, 24, 32, 18, 26, 22, 30, 16, 28, 24, 20, 34, 22, 18, 26, 32, 20, 24].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
