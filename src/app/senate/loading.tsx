import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SenateLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-surface-300 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-32 rounded-lg bg-surface-300 animate-pulse" />
            <div className="h-3 w-48 rounded-md bg-surface-200 animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-5 w-3/4 rounded-md bg-surface-300" />
                <div className="h-4 w-1/3 rounded-md bg-surface-200" />
              </div>
              <div className="h-3 rounded-full bg-surface-300" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-xl bg-surface-200" />
                <div className="h-20 rounded-xl bg-surface-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 rounded-xl bg-surface-300" />
                <div className="h-10 rounded-xl bg-surface-300" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
