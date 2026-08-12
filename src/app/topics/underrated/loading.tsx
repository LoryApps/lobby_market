import { Gem } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30">
            <Gem className="h-6 w-6 text-emerald animate-pulse" />
          </div>
          <div>
            <div className="h-6 w-44 rounded-lg bg-surface-300/50 animate-pulse mb-2" />
            <div className="h-4 w-64 rounded-lg bg-surface-300/30 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full bg-surface-300/50 animate-pulse" />
                <div className="h-4 w-20 rounded bg-surface-300/30 animate-pulse" />
              </div>
              <div className="h-4 w-full rounded bg-surface-300/50 animate-pulse" />
              <div className="h-3.5 w-3/4 rounded bg-surface-300/30 animate-pulse" />
              <div className="h-1.5 w-full rounded-full bg-surface-300/50 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-5 w-24 rounded-full bg-surface-300/40 animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-surface-300/30 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
