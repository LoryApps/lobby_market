import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function GoalsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12 animate-pulse">
        <div className="h-8 w-48 bg-surface-300 rounded mb-2" />
        <div className="h-4 w-64 bg-surface-300 rounded mb-8" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface-200 border border-surface-300 rounded-2xl p-5 mb-4">
            <div className="flex justify-between mb-3">
              <div className="h-5 w-32 bg-surface-300 rounded" />
              <div className="h-5 w-16 bg-surface-300 rounded" />
            </div>
            <div className="h-2 bg-surface-300 rounded-full" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
