import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function FrontierLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-24 md:pb-12">
        <div className="animate-pulse">
          <div className="h-9 bg-surface-300/50 rounded-xl w-48 mb-6" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
