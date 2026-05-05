import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function LawTodayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="h-12 w-48 rounded-xl bg-surface-200 animate-pulse mb-6" />
        <div className="space-y-5">
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-4 animate-pulse">
            <div className="h-5 w-32 rounded bg-surface-300" />
            <div className="h-7 w-full rounded bg-surface-300" />
            <div className="h-7 w-3/4 rounded bg-surface-300" />
            <div className="h-3 w-full rounded-full bg-surface-300" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5 h-36 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
