import { Bookmark } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SavedArgumentsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Bookmark className="h-5 w-5 text-for-400" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-5">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>

        {/* Argument cards */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              {/* Author + meta */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-14 rounded-full ml-1" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              {/* Content */}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              {/* Topic link */}
              <div className="rounded-lg bg-surface-200 border border-surface-300 p-3 space-y-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
              {/* Actions */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
