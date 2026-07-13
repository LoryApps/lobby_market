import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SupplyDayLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-300/50 rounded-lg" />
          <div className="h-4 w-72 bg-surface-300/30 rounded" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-20" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-44" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
