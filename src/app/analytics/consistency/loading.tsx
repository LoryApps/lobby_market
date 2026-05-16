import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function ConsistencyLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        <Skel className="h-6 w-40" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Skel className="h-36 w-36 rounded-full" />
            <div className="flex-1 space-y-3 w-full">
              <Skel className="h-3 w-24" />
              <Skel className="h-8 w-48" />
              <Skel className="h-3 w-full max-w-xs" />
              <Skel className="h-3 w-4/5 max-w-xs" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skel className="h-3 w-16" />
              <Skel className="h-7 w-12" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <Skel className="h-4 w-24" />
              <Skel className="h-2 w-full rounded-full" />
              <Skel className="h-3 w-32" />
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
