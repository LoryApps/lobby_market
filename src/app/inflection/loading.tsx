import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function InflectionLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6 pb-24 animate-pulse">
        <div className="space-y-1">
          <div className="h-4 w-16 rounded bg-surface-300/50" />
          <div className="h-7 w-64 rounded-lg bg-surface-300/50 mt-3" />
          <div className="h-4 w-80 rounded bg-surface-300/30 mt-1" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-100 border border-surface-300" />
          ))}
        </div>
        <div className="h-48 rounded-2xl bg-surface-100 border border-surface-300" />
        <div className="h-40 rounded-2xl bg-gold/5 border border-gold/20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-surface-100 border border-surface-300" />
        ))}
      </main>
      <BottomNav />
    </div>
  )
}
