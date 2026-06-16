import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CoalitionConstitutionLoading() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-surface-200 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-56 rounded bg-surface-200 animate-pulse" />
            <div className="h-3 w-32 rounded bg-surface-200 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-72 rounded-full bg-surface-200 animate-pulse" />
        <div className="bg-surface-200 border border-surface-300 rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="h-6 w-40 rounded bg-surface-300" />
          <div className="h-4 w-full rounded bg-surface-300/60" />
          <div className="h-4 w-5/6 rounded bg-surface-300/60" />
          <div className="h-4 w-4/6 rounded bg-surface-300/60" />
          <div className="h-5 w-36 rounded bg-surface-300 mt-4" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3.5 rounded bg-surface-300/50" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
