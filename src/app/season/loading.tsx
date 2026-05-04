import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SeasonLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12 space-y-4 animate-pulse">
        <div className="h-40 rounded-2xl bg-surface-200/60" />
        <div className="h-10 rounded-xl bg-surface-200/40 w-48" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-200/30" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
