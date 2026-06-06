import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ClozeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="max-w-xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <Skeleton className="h-11 w-11 rounded-2xl mx-auto" />
          <Skeleton className="h-7 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        {/* Round progress */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`h-2 rounded-full ${i === 0 ? 'w-8' : 'w-5'}`} />
          ))}
        </div>

        {/* Statement card with blank */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6 mb-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-px" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Statement with blank */}
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-7 w-24 rounded-lg border-2 border-dashed border-surface-400" />
              <Skeleton className="h-5 w-1/4" />
            </div>
            <Skeleton className="h-5 w-4/5" />
          </div>
        </div>

        {/* Answer options grid */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-13 rounded-xl" style={{ height: '52px' }} />
          ))}
        </div>

        {/* Score */}
        <div className="flex justify-between items-center mt-6 px-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
