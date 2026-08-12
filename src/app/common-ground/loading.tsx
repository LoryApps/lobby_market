import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function CommonGroundLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Pulse className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Pulse className="h-5 w-40" />
            <Pulse className="h-3 w-52" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Pulse className="h-7 w-14 mx-auto mb-2" />
              <Pulse className="h-3 w-20 mx-auto" />
            </div>
          ))}
        </div>

        {/* Converging section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-52" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3.5">
                <Pulse className="h-4 w-full mb-1.5" />
                <Pulse className="h-4 w-3/4 mb-3" />
                <Pulse className="h-2 w-full rounded-full mb-2" />
                <div className="flex gap-2">
                  <Pulse className="h-4 w-16 rounded-full" />
                  <Pulse className="h-4 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Laws section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-44" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3.5">
                <Pulse className="h-4 w-full mb-1.5" />
                <Pulse className="h-4 w-2/3 mb-3" />
                <div className="flex gap-2 mb-2">
                  <Pulse className="h-3.5 w-16 rounded-full" />
                  <Pulse className="h-3.5 w-20" />
                </div>
                <Pulse className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Battle lines */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3.5">
                <Pulse className="h-4 w-full mb-1.5" />
                <Pulse className="h-4 w-5/6 mb-3" />
                <Pulse className="h-1.5 w-full rounded-full mb-2" />
                <div className="flex gap-2">
                  <Pulse className="h-3.5 w-16 rounded-full" />
                  <Pulse className="h-3.5 w-20" />
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
