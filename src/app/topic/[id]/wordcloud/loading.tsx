import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-24">
        <div className="h-6 w-48 rounded bg-surface-200 animate-pulse mb-2" />
        <div className="h-8 w-full max-w-lg rounded bg-surface-200 animate-pulse mb-8" />
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div className="h-12 rounded-xl bg-surface-200 animate-pulse" />
            <div className="h-48 rounded-xl bg-surface-200 animate-pulse" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-12 rounded-xl bg-surface-200 animate-pulse" />
            <div className="h-48 rounded-xl bg-surface-200 animate-pulse" />
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
