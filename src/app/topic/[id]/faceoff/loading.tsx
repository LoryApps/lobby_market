import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FaceoffLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-36" />
        </div>

        {/* Topic card skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="pt-1 space-y-1">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-2.5 w-18" />
            </div>
          </div>
        </div>

        {/* Prompt */}
        <Skeleton className="h-3 w-48 mx-auto mb-4" />

        {/* Two argument card skeletons */}
        {[0, 1].map(i => (
          <div key={i}>
            {i === 1 && (
              <div className="flex items-center gap-3 my-3">
                <div className="h-px flex-1 bg-surface-300" />
                <Skeleton className="h-3 w-4" />
                <div className="h-px flex-1 bg-surface-300" />
              </div>
            )}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-3 w-14" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-9/12" />
                <Skeleton className="h-3.5 w-10/12" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-8 rounded ml-auto" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
