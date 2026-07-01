import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-surface-300/50 animate-pulse" />
        <div className="h-28 w-full rounded-2xl bg-surface-300/50 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-surface-300/50 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-5 w-36 rounded bg-surface-300/50 animate-pulse" />
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-surface-300/50 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
