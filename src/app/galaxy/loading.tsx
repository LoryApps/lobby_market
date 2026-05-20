import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GalaxyLoading() {
  return (
    <div className="flex flex-col h-screen bg-[#060810] overflow-hidden">
      <TopBar />

      {/* Toolbar skeleton */}
      <div className="flex-shrink-0 border-b border-surface-300/40 bg-surface-100/60">
        <div className="max-w-[1800px] mx-auto px-4 h-12 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-44 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Canvas placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-purple/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-purple/50 animate-pulse" />
          </div>
          <p className="font-mono text-xs text-surface-500">Charting the galaxy…</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
