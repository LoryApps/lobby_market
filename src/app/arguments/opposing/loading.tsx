import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function OpposingLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-6">
          <div className="h-3 w-24 bg-surface-200 rounded animate-pulse mb-3" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-surface-200 animate-pulse flex-shrink-0" />
            <div>
              <div className="h-6 w-48 bg-surface-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-72 bg-surface-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden animate-pulse">
              <div className="h-0.5 bg-surface-300" />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 bg-surface-200 rounded-md" />
                  <div className="h-5 w-8 bg-surface-200 rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-surface-200 rounded" />
                  <div className="h-3 w-5/6 bg-surface-200 rounded" />
                  <div className="h-3 w-4/6 bg-surface-200 rounded" />
                </div>
                <div className="h-14 bg-surface-200 rounded-xl" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-surface-200" />
                    <div className="h-3 w-20 bg-surface-200 rounded" />
                  </div>
                  <div className="h-3 w-12 bg-surface-200 rounded" />
                </div>
                <div className="h-8 bg-surface-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
