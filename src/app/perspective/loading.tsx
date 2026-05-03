import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function PerspectiveLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 animate-pulse">
          <div className="h-9 w-9 rounded-lg bg-surface-300" />
          <div>
            <div className="h-6 w-44 bg-surface-300 rounded mb-1" />
            <div className="h-4 w-60 bg-surface-300 rounded" />
          </div>
        </div>

        {/* Topic search */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 animate-pulse">
          <div className="h-4 w-28 bg-surface-300 rounded mb-3" />
          <div className="h-10 bg-surface-200 rounded-lg mb-3" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-for-500/20 rounded-xl" />
            <div className="h-12 bg-against-500/20 rounded-xl" />
          </div>
        </div>

        {/* Steel-man panel */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-purple/20" />
            <div className="h-5 w-36 bg-surface-300 rounded" />
          </div>
          <div className="space-y-2 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-surface-300 rounded" style={{ width: `${92 - i * 6}%` }} />
            ))}
          </div>
          <div className="h-px bg-surface-300 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-surface-300 rounded" style={{ width: `${88 - i * 8}%` }} />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
