import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-surface-300/50 rounded" />
          <div className="h-7 w-56 bg-surface-300/50 rounded" />
          <div className="h-44 bg-surface-100 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-100 rounded-xl" />
            ))}
          </div>
          <div className="h-52 bg-surface-100 rounded-2xl" />
          <div className="h-32 bg-surface-100 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
