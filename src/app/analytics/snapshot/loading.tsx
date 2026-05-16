import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function SnapshotLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Skel className="h-9 w-9 rounded-xl" />
          <Skel className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skel className="h-6 w-40" />
            <Skel className="h-3 w-52" />
          </div>
        </div>
        {/* Identity card skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-4">
          <div className="flex items-center gap-4">
            <Skel className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skel className="h-6 w-36" />
              <Skel className="h-4 w-24" />
              <Skel className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-surface-200/60 p-4 space-y-2">
                <Skel className="h-3 w-14" />
                <Skel className="h-7 w-10" />
              </div>
            ))}
          </div>
        </div>
        {/* Score bars skeleton */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-4">
          <Skel className="h-4 w-28 mb-2" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skel className="h-3 w-32" />
                <Skel className="h-3 w-10" />
              </div>
              <Skel className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-32 animate-pulse" />
      </main>
      <BottomNav />
    </div>
  )
}
