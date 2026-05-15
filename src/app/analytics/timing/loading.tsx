import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function TimingLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <Skel className="h-6 w-48" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
          <Skel className="h-4 w-32" />
          <Skel className="h-12 w-48" />
          <Skel className="h-3 w-full" />
          <Skel className="h-3 w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skel className="h-3 w-20" />
              <Skel className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skel className="h-4 w-28" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skel className="h-3 w-12 flex-shrink-0" />
                <Skel className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
