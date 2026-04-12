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
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Network className="h-5 w-5 text-gold" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>

        {/* Graph canvas placeholder */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="relative w-full" style={{ height: '60vh', minHeight: 400 }}>
            <Skeleton className="absolute inset-0 rounded-none" />
            {/* Simulated node clusters */}
            {[
              { top: '20%', left: '30%', size: 'h-8 w-8' },
              { top: '50%', left: '20%', size: 'h-6 w-6' },
              { top: '35%', left: '55%', size: 'h-10 w-10' },
              { top: '65%', left: '45%', size: 'h-7 w-7' },
              { top: '25%', left: '70%', size: 'h-5 w-5' },
              { top: '70%', left: '65%', size: 'h-8 w-8' },
              { top: '45%', left: '80%', size: 'h-6 w-6' },
            ].map((n, i) => (
              <div
                key={i}
                className={`absolute ${n.size} rounded-full bg-surface-300/60 border border-surface-400/40 animate-pulse`}
                style={{ top: n.top, left: n.left, transform: 'translate(-50%,-50%)' }}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
