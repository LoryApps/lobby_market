import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { BookOpen } from 'lucide-react'

export default function SourcesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10 border border-emerald/30 flex-shrink-0">
                <BookOpen className="h-4 w-4 text-emerald" aria-hidden />
              </div>
              <Skeleton className="h-7 w-40" />
            </div>
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0 mt-0.5" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 space-y-1.5 flex flex-col items-center">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg flex-shrink-0" />
          ))}
          <Skeleton className="h-8 w-24 rounded-lg flex-shrink-0 ml-auto" />
        </div>

        {/* Source cards */}
        <div className="space-y-3" aria-busy="true" aria-label="Loading sources">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16 flex-shrink-0" />
              </div>
              <div className="pl-9 space-y-1.5">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
