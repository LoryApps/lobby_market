import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function MyWeekLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-4">
        <div className="h-8 w-32 rounded-lg bg-surface-200 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40 animate-pulse" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-32 animate-pulse" />
      </main>
      <BottomNav />
    </div>
  )
}
