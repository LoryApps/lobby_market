import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicFormLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl bg-surface-200 animate-pulse" />
          <div>
            <div className="h-6 w-36 rounded-lg bg-surface-200 animate-pulse mb-1" />
            <div className="h-4 w-56 rounded-lg bg-surface-200 animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-48 animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-28 animate-pulse" />
          ))}
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-32 animate-pulse mb-4" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40 animate-pulse mb-4" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-24 animate-pulse" />
      </main>
      <BottomNav />
    </div>
  )
}
