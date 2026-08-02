import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-950">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-surface-300/50 rounded" />
          <div className="h-8 w-48 bg-surface-300/50 rounded" />
          <div className="h-20 bg-surface-100 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface-100 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
