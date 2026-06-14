import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 pb-24">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-32 bg-surface-300 rounded" />
          <div className="h-8 w-64 bg-surface-300 rounded" />
          <div className="h-20 bg-surface-200 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-52 bg-surface-200 rounded-2xl" />
            <div className="h-52 bg-surface-200 rounded-2xl" />
          </div>
          <div className="h-24 bg-surface-200 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
