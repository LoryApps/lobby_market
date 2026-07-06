import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="h-5 w-32 rounded bg-surface-300/40 animate-pulse mb-6" />
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl bg-surface-300/40 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-surface-300/40 animate-pulse" />
            <div className="h-4 w-32 rounded bg-surface-300/40 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1 mb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-24 rounded-lg bg-surface-300/40 animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
              <div className="h-10 w-10 rounded-full bg-surface-300/40 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-surface-300/40 animate-pulse" />
                <div className="h-3 w-24 rounded bg-surface-300/40 animate-pulse" />
              </div>
              <div className="hidden sm:flex flex-col gap-1 items-end">
                <div className="h-3.5 w-14 rounded bg-surface-300/40 animate-pulse" />
                <div className="h-3 w-12 rounded bg-surface-300/40 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
