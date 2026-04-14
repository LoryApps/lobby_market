import { Trophy } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateRecapLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
        </div>

        {/* Hero result card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gold/10 border border-gold/30">
              <Trophy className="h-6 w-6 text-gold" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>

          {/* Two-column participant display */}
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-surface-200 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Sway meter */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-3 w-full rounded-full mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Transcript / highlights */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="p-4 border-b border-surface-300 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex items-start gap-3 ${i % 2 ? 'flex-row-reverse' : ''}`}>
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 max-w-[72%] space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <div className="rounded-2xl bg-surface-200 p-3 space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
