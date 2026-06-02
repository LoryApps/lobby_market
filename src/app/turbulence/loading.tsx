import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TurbulenceLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-5 pb-24 animate-pulse">
        <div className="h-14 rounded-2xl bg-surface-200/50" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-surface-200/50 border border-surface-300" />
          ))}
        </div>
        <div className="h-16 rounded-2xl bg-surface-200/50 border border-surface-300" />
        <div className="h-10 rounded-xl bg-surface-200/50 border border-surface-300" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-surface-200/50 border border-surface-300" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
