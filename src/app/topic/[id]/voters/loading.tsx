import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function VotersLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Back link skeleton */}
        <Sk className="h-4 w-24 mb-6" />

        {/* Topic card skeleton */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6 space-y-3">
          <Sk className="h-3 w-28" />
          <Sk className="h-5 w-full" />
          <Sk className="h-4 w-3/4" />
          <Sk className="h-2.5 w-full rounded-full" />
        </div>

        {/* Section header */}
        <div className="flex items-center gap-2 mb-5">
          <Sk className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="space-y-1.5">
            <Sk className="h-4 w-24" />
            <Sk className="h-3 w-40" />
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              <Sk className="h-16 w-full rounded-xl" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-surface-100 border border-surface-300">
                  <Sk className="h-4 w-4 rounded-full flex-shrink-0" />
                  <Sk className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Sk className="h-3.5 w-24" />
                    <Sk className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
