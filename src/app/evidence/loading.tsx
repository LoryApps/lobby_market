import { BookOpen } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function EvidenceLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <BookOpen className="h-5 w-5 text-emerald" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
              <Skeleton className="h-6 w-10 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Filter bar */}
            <Skeleton className="h-9 w-72 rounded-xl" />
            {/* Cards */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 w-10">
                    <Skeleton className="h-8 w-8 rounded-xl" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                </div>
                <div className="mt-3 pt-3 border-t border-surface-300/50 flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar skeleton */}
          <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
