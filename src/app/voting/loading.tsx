import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

function CardSk() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Sk className="h-5 w-20 rounded-full" />
        <Sk className="h-5 w-16 rounded-full" />
      </div>
      <Sk className="h-5 w-full" />
      <Sk className="h-4 w-4/5" />
      <div className="space-y-2 pt-1">
        <div className="flex justify-between">
          <Sk className="h-3 w-20" />
          <Sk className="h-3 w-16" />
        </div>
        <Sk className="h-3 w-full rounded-full" />
        <div className="flex justify-between pt-0.5">
          <Sk className="h-3 w-16" />
          <Sk className="h-3 w-14" />
        </div>
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 space-y-6">
        {/* Hero skeleton */}
        <div className="text-center space-y-3 py-4">
          <Sk className="h-12 w-12 rounded-2xl mx-auto" />
          <Sk className="h-8 w-72 mx-auto" />
          <Sk className="h-4 w-80 max-w-full mx-auto" />
        </div>
        {/* Stats bar skeleton */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-100/60 border border-surface-300/50 p-3 space-y-1.5">
              <Sk className="h-5 w-8 mx-auto" />
              <Sk className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
        {/* Filter skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        {/* Cards */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSk key={i} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
