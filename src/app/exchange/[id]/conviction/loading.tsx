import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/40 ${className ?? ''}`} />
}

export default function MarketConvictionLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Skel className="h-9 w-9 rounded-lg" />
          <Skel className="h-4 w-48" />
        </div>
        <Skel className="h-5 w-full" />
        <Skel className="h-4 w-3/4" />

        {/* Score rings */}
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col items-center gap-3">
              <Skel className="h-24 w-24 rounded-full" />
              <Skel className="h-3 w-16" />
              <Skel className="h-3 w-12" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <Skel className="h-4 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skel className="h-3 w-20" />
                <Skel className="h-3 w-8" />
              </div>
              <Skel className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Argument cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skel className="h-4 w-24" />
              <Skel className="h-16 w-full" />
              <div className="flex items-center gap-2">
                <Skel className="h-6 w-6 rounded-full" />
                <Skel className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
