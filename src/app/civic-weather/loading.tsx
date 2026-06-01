import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function CivicWeatherLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-6 pb-24 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Sk className="h-8 w-48" />
          <Sk className="h-4 w-80" />
        </div>

        {/* Global forecast card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Sk className="h-16 w-16 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Sk className="h-6 w-40" />
              <Sk className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200 p-3 space-y-1.5">
                <Sk className="h-3 w-16" />
                <Sk className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Sk className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Sk className="h-4 w-24" />
                  <Sk className="h-3 w-36" />
                </div>
                <Sk className="h-6 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="rounded-lg bg-surface-200 p-2 space-y-1">
                    <Sk className="h-2 w-12" />
                    <Sk className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
