import { GitFork, TrendingUp } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

function ChainCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 space-y-3">
      {/* Root topic row */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex items-center gap-2 pt-0.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full ml-auto" />
          </div>
        </div>
      </div>
      {/* Vote bar */}
      <Skeleton className="h-1.5 w-full rounded-full" />
      {/* Chain nodes */}
      <div className="pl-4 border-l border-surface-400/20 space-y-2 mt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded flex-shrink-0" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded flex-shrink-0" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export default function ChainsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <GitFork className="h-5 w-5 text-purple" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>

        {/* Toolbar: sort + category */}
        <div className="flex flex-col gap-3 mb-5 p-3 rounded-xl bg-surface-100 border border-surface-300">
          {/* Sort buttons */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-7 w-20 rounded-lg flex-shrink-0" />
            <Skeleton className="h-7 w-28 rounded-lg flex-shrink-0" />
            <Skeleton className="h-7 w-16 rounded-lg flex-shrink-0" />
          </div>
          {/* Category chips */}
          <div className="flex items-center gap-1.5 overflow-hidden">
            <TrendingUp className="h-3 w-3 text-surface-600 flex-shrink-0" />
            <Skeleton className="h-5 w-10 rounded-full flex-shrink-0" />
            <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
            <Skeleton className="h-5 w-20 rounded-full flex-shrink-0" />
            <Skeleton className="h-5 w-14 rounded-full flex-shrink-0" />
            <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
          </div>
        </div>

        {/* Chain cards */}
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <ChainCardSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
