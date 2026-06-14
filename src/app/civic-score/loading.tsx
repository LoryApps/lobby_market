import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Skel({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

export default function CivicScoreLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <Skel className="h-9 w-9 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skel className="h-5 w-32" />
            <Skel className="h-3 w-48" />
          </div>
        </div>
        {/* Hero score card */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 flex flex-col items-center gap-4">
          <Skel className="h-40 w-40 rounded-full" />
          <Skel className="h-6 w-24" />
          <Skel className="h-4 w-56" />
          <Skel className="h-7 w-32 rounded-full" />
        </div>
        {/* Breakdown */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skel className="h-4 w-28" />
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skel className="h-3 w-20" />
              <Skel className="h-2 flex-1 rounded-full" />
              <Skel className="h-3 w-7" />
            </div>
          ))}
        </div>
        {/* Dimension cards */}
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-4">
              <Skel className="h-10 w-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-24" />
                <Skel className="h-1.5 w-full rounded-full" />
                <Skel className="h-2.5 w-32" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
