import Link from 'next/link'
import { ArrowLeft, Scroll } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <Scroll className="h-12 w-12 text-surface-500 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Category Not Found</h1>
        <p className="text-sm text-surface-400 mb-6 max-w-xs">
          That thesis category doesn't exist. Browse all available categories below.
        </p>
        <Link
          href="/thesis"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-for-600 hover:bg-for-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Theses
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
