import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CrossroadsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>

        {/* Scenario card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Choice cards */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex items-center justify-center">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>

        {/* Quote */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-32" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
