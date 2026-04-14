import { Network } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LawGraphLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
            <Network className="h-5 w-5 text-emerald" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>

        {/* Graph canvas placeholder */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-4">
          <div className="relative w-full h-[420px] sm:h-[520px] flex items-center justify-center">
            {/* Simulated node cluster */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-14 w-14 rounded-full animate-pulse" />
            </div>
            {/* Surrounding nodes */}
            {[
              { top: '20%', left: '20%' },
              { top: '20%', right: '20%' },
              { bottom: '20%', left: '25%' },
              { bottom: '20%', right: '25%' },
              { top: '50%', left: '12%' },
              { top: '50%', right: '12%' },
            ].map((pos, i) => (
              <div key={i} className="absolute" style={pos}>
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Linked laws list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
