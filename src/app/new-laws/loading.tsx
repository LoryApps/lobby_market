import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NewLawsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-surface-300/50 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-surface-300/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 w-20 rounded-2xl bg-surface-100 border border-surface-300 animate-pulse"
            />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40 animate-pulse"
            />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
