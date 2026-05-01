import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function RadarLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-surface-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-36 rounded bg-surface-200 animate-pulse" />
            <div className="h-4 w-52 rounded bg-surface-200 animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface-100 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
