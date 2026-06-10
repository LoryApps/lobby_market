import { Swords } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ClashLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
            <Swords className="h-5 w-5 text-gold animate-pulse" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">The Clash</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Loading battles…</p>
          </div>
        </div>

        {/* Sort/filter placeholders */}
        <div className="flex gap-2 mb-4">
          {[80, 120, 100].map((w) => (
            <Skeleton key={w} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>
        <div className="flex gap-2 mb-5 overflow-hidden">
          {[60, 70, 80, 90, 60, 75].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full flex-shrink-0" style={{ width: w }} />
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
              <div className="p-4 border-b border-surface-300 flex justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
                <Skeleton className="h-8 w-16 rounded-lg ml-3" />
              </div>
              <div className="grid grid-cols-2 divide-x divide-surface-300">
                {[0, 1].map((j) => (
                  <div key={j} className="p-4 space-y-3">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-16 w-full" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-surface-300">
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
