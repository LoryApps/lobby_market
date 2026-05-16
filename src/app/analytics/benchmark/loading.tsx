import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function BenchmarkLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <div className="flex items-center gap-3">
          <Skel className="h-9 w-9 rounded-xl" />
          <Skel className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skel className="h-6 w-36" />
            <Skel className="h-3 w-52" />
          </div>
        </div>
        {/* Cohort info skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex items-center gap-4">
          <Skel className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skel className="h-4 w-40" />
            <Skel className="h-3 w-56" />
          </div>
        </div>
        {/* Percentile bars */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5">
          <Skel className="h-4 w-32 mb-2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skel className="h-4 w-28" />
                <Skel className="h-4 w-20" />
              </div>
              <div className="relative h-3 rounded-full bg-surface-300">
                <Skel className="absolute top-0 left-0 h-3 rounded-full" style={{ width: `${30 + i * 15}%` }} />
              </div>
              <Skel className="h-3 w-40" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skel className="h-3 w-16" />
              <Skel className="h-7 w-14" />
              <Skel className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
