import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicDecoderLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-8 pb-24 flex flex-col items-center gap-4 animate-pulse">
        <div className="h-8 w-48 bg-surface-300/40 rounded-lg" />
        <div className="h-4 w-64 bg-surface-300/30 rounded" />
        <div className="mt-6 w-full h-48 bg-surface-200/60 rounded-2xl" />
        <div className="w-full space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-surface-200/60 rounded-xl" />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
