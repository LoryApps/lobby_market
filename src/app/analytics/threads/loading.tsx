import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-lg bg-surface-200 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 rounded bg-surface-300 animate-pulse" />
            <div className="h-3 w-48 rounded bg-surface-300/60 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2 animate-pulse">
              <div className="h-3 w-20 rounded bg-surface-300/60" />
              <div className="h-8 w-16 rounded bg-surface-300/80" />
              <div className="h-3 w-14 rounded bg-surface-300/40" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
