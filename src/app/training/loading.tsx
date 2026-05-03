import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TrainingLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-11 w-11 rounded-xl bg-surface-300" />
          <div>
            <div className="h-6 w-40 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-56 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-surface-200 rounded-lg" />
          ))}
        </div>

        {/* Exercise cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 animate-pulse">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-surface-300 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-5 w-40 bg-surface-300 rounded mb-2" />
                  <div className="h-4 w-full bg-surface-300 rounded" />
                </div>
                <div className="h-6 w-16 bg-surface-300 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-surface-300 rounded w-3/4" />
                <div className="h-3 bg-surface-300 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
