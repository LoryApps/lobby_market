import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function TopicOfTheDayLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Block className="h-3 w-24" />
              <Block className="h-5 w-36" />
            </div>
            <div className="space-y-2">
              <Block className="h-3 w-32" />
              <Block className="h-3 w-24" />
            </div>
          </div>

          {/* Reason banner */}
          <Block className="h-12 rounded-xl" />

          {/* Main topic card */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <Block className="h-5 w-16 rounded-full" />
                <Block className="h-5 w-20 rounded-full" />
              </div>
              <Block className="h-7 w-full" />
              <Block className="h-5 w-4/5" />
              <Block className="h-3 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-3 border-t border-surface-200 divide-x divide-surface-200">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center py-4 gap-2">
                  <Block className="h-3.5 w-3.5 rounded" />
                  <Block className="h-5 w-10" />
                  <Block className="h-2.5 w-14" />
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-3">
              <Block className="flex-1 h-10 rounded-lg" />
              <Block className="h-10 w-28 rounded-lg" />
              <Block className="h-10 w-10 rounded-lg" />
            </div>
          </div>

          {/* Arguments */}
          <div>
            <Block className="h-4 w-40 mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Block className="h-40 rounded-xl" />
              <Block className="h-40 rounded-xl" />
            </div>
          </div>

          {/* Go deeper */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-200">
              <Block className="h-4 w-20" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-200 last:border-0">
                <Block className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Block className="h-3.5 w-32" />
                  <Block className="h-3 w-48" />
                </div>
                <Block className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
