import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ClashDetailLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-900">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-4 animate-pulse">
          <div className="h-4 w-32 bg-surface-700/50 rounded" />
          <div className="h-10 bg-surface-700/30 rounded-xl" />
          <div className="h-28 bg-surface-700/30 rounded-xl" />
          <div className="flex gap-3">
            <div className="flex-1 h-40 bg-surface-700/30 rounded-xl" />
            <div className="w-8 h-40 bg-surface-700/20 rounded" />
            <div className="flex-1 h-40 bg-surface-700/30 rounded-xl" />
          </div>
          <div className="h-32 bg-surface-700/30 rounded-xl" />
          <div className="h-48 bg-surface-700/30 rounded-xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
