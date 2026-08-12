import { ShieldAlert } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function StressTestLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">
        <div className="mb-8">
          <div className="h-4 w-32 rounded bg-surface-200 animate-pulse mb-5" />
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-surface-200 animate-pulse flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-56 rounded bg-surface-200 animate-pulse" />
              <div className="h-4 w-72 rounded bg-surface-200 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-36 rounded-xl bg-surface-200 animate-pulse" />
          <div className="h-24 rounded-xl bg-surface-200 animate-pulse" />
          <div className="h-32 rounded-xl bg-surface-200 animate-pulse" />
          <div className="h-12 rounded-xl bg-surface-200 animate-pulse" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
