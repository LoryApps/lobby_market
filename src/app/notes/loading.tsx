import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'

export default function NotesLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-6 pb-28">
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      </main>
    </div>
  )
}
