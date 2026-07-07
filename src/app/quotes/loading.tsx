import { Quote } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function QuoteCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4 break-inside-avoid">
      {/* Side badge + upvotes */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>

      {/* Quote icon + text */}
      <div className="space-y-2">
        <Quote className="h-5 w-5 text-surface-700 opacity-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        {tall && <Skeleton className="h-4 w-3/4" />}
      </div>

      {/* Topic context */}
      <div className="space-y-1 rounded-lg bg-surface-200/60 p-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      {/* Author */}
      <div className="flex items-center gap-2 border-t border-surface-300 pt-3">
        <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

export default function QuotesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-1 w-6 rounded-full bg-for-500/60" />
            <Skeleton className="h-3 w-20" />
            <div className="flex h-1 w-6 rounded-full bg-against-500/60" />
          </div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {[80, 95, 70, 90, 75].map((w, i) => (
            <Skeleton key={i} className="flex-shrink-0 h-8 rounded-lg" style={{ width: w }} />
          ))}
          <Skeleton className="flex-shrink-0 h-8 w-20 rounded-lg ml-auto" />
        </div>

        {/* Masonry grid — 3 col on desktop */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          <QuoteCardSkeleton />
          <QuoteCardSkeleton tall />
          <QuoteCardSkeleton />
          <QuoteCardSkeleton tall />
          <QuoteCardSkeleton />
          <QuoteCardSkeleton tall />
          <QuoteCardSkeleton />
          <QuoteCardSkeleton />
          <QuoteCardSkeleton tall />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
