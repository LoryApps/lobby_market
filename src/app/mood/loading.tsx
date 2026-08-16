import { Heart } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function MoodLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-against-400" />
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Civic Mood
            </h1>
          </div>
          <p className="text-sm text-surface-500 font-mono">
            How civic debate makes the community feel — right now.
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
