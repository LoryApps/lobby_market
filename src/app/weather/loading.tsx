import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WeatherLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-11 w-11 rounded-xl bg-surface-300" />
          <div>
            <div className="h-6 w-52 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-44 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Global forecast hero */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-surface-300" />
            <div className="flex-1">
              <div className="h-7 w-40 bg-surface-300 rounded mb-2" />
              <div className="h-4 w-full bg-surface-300 rounded mb-1" />
              <div className="h-4 w-3/4 bg-surface-300 rounded" />
            </div>
          </div>
        </div>

        {/* Category weather grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-surface-300" />
                <div className="h-5 w-24 bg-surface-300 rounded" />
                <div className="ml-auto h-6 w-6 bg-surface-300 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="text-center">
                    <div className="h-4 w-8 bg-surface-300 rounded mx-auto mb-1" />
                    <div className="h-3 w-12 bg-surface-300 rounded mx-auto" />
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
