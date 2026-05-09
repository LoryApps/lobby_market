import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicTimelineLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-8 pb-28">
        <div className="h-4 w-24 rounded-lg bg-surface-200 animate-pulse mb-6" />
        <div className="h-8 w-48 rounded-lg bg-surface-200 animate-pulse mb-3" />
        <div className="h-4 w-72 rounded-lg bg-surface-200 animate-pulse mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-200 animate-pulse" />
          ))}
        </div>
        <div className="mt-5 h-11 rounded-xl bg-surface-200 animate-pulse" />
      </main>
      <BottomNav />
    </div>
  )
}
