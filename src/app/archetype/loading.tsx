import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ArchetypeLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-10 pb-24 flex flex-col items-center gap-6">
        <div className="h-16 w-16 rounded-2xl bg-surface-200 animate-pulse" />
        <div className="h-8 w-64 rounded-lg bg-surface-200 animate-pulse" />
        <div className="h-4 w-48 rounded bg-surface-200 animate-pulse" />
        <div className="w-full mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-200 animate-pulse" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
