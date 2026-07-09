import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TranscriptLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-5 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        </div>

        {/* Badge + Title */}
        <div className="mb-8 space-y-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-surface-300 mb-8" />

        {/* Legs */}
        <div className="space-y-7">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pl-5 relative">
              <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-surface-300 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                {i < 3 && <Skeleton className="h-4 w-3/4" />}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
