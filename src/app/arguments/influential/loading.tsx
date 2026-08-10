import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} />
}

function CardSk() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5 space-y-4">
      <div className="flex items-center gap-3 pl-3">
        <Sk className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Sk className="h-3.5 w-28" />
          <Sk className="h-3 w-20" />
        </div>
        <Sk className="h-5 w-16 rounded-full" />
      </div>
      <div className="pl-3 space-y-2">
        <Sk className="h-3.5 w-full" />
        <Sk className="h-3.5 w-5/6" />
        <Sk className="h-3.5 w-4/5" />
      </div>
      <div className="pl-3">
        <Sk className="h-16 w-full rounded-xl" />
      </div>
      <div className="pl-3 flex gap-2">
        <Sk className="h-3 w-16" />
        <Sk className="h-3 w-14" />
        <Sk className="h-3 w-12" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 space-y-6">
        <div className="text-center space-y-3 py-4">
          <Sk className="h-12 w-12 rounded-2xl mx-auto" />
          <Sk className="h-8 w-64 mx-auto" />
          <Sk className="h-4 w-96 max-w-full mx-auto" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSk key={i} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
