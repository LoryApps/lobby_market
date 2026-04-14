import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Pulse({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
  )
}

export default function DigestLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Pulse className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Pulse className="h-5 w-36" />
            <Pulse className="h-3 w-28" />
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <Pulse className="h-7 w-12 mx-auto mb-2" />
              <Pulse className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>

        {/* Laws section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-48" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3.5">
                <Pulse className="h-4 w-full mb-2" />
                <Pulse className="h-4 w-3/4 mb-3" />
                <div className="flex gap-2">
                  <Pulse className="h-4 w-16 rounded-full" />
                  <Pulse className="h-4 w-20" />
                </div>
                <Pulse className="h-1.5 w-full rounded-full mt-2.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Spotlight */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-36" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <Pulse className="h-4 w-24 mb-2" />
                <Pulse className="h-4 w-full mb-1" />
                <Pulse className="h-4 w-5/6 mb-1" />
                <Pulse className="h-4 w-4/6 mb-2" />
                <Pulse className="h-3 w-32 mb-2" />
                <Pulse className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Top voices */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Pulse className="h-9 w-9 rounded-xl" />
            <Pulse className="h-5 w-28" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
                <Pulse className="h-5 w-5 rounded" />
                <Pulse className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Pulse className="h-4 w-32" />
                  <Pulse className="h-3 w-24" />
                </div>
                <div className="text-right space-y-1">
                  <Pulse className="h-4 w-12 ml-auto" />
                  <Pulse className="h-3 w-8 ml-auto" />
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
