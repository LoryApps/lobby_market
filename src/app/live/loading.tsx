import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-surface-300/50 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-surface-300/50" />
          <div className="h-3 w-48 rounded bg-surface-300/50" />
        </div>
        <div className="h-5 w-14 rounded-full bg-surface-300/50" />
      </div>
      <div className="h-3.5 w-full rounded bg-surface-300/50" />
      <div className="h-3.5 w-4/5 rounded bg-surface-300/50" />
    </div>
  )
}

export default function LiveLoading() {
  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        <div className="border-b border-surface-300/40 bg-surface-50/90">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 animate-pulse">
                <div className="h-7 w-7 rounded-lg bg-surface-300/50" />
                <div className="space-y-1">
                  <div className="h-3.5 w-28 rounded bg-surface-300/50" />
                  <div className="h-3 w-20 rounded bg-surface-300/50" />
                </div>
              </div>
              <div className="flex gap-2 animate-pulse">
                <div className="h-7 w-20 rounded-full bg-surface-300/50" />
                <div className="h-7 w-16 rounded-full bg-surface-300/50" />
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 pt-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
