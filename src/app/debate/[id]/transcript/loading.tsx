import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DebateTranscriptLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-6 w-56 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        </div>

        {/* Debate info card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>

        {/* Transcript messages */}
        <div className="space-y-4">
          {[
            { side: 'for', lines: 2 },
            { side: 'against', lines: 3 },
            { side: 'for', lines: 1 },
            { side: 'against', lines: 2 },
            { side: 'for', lines: 4 },
            { side: 'against', lines: 2 },
          ].map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.side === 'against' ? 'flex-row-reverse' : ''}`}>
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-1" />
              <div className="max-w-[75%] space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
                <div className={`rounded-2xl ${msg.side === 'for' ? 'bg-for-950/60' : 'bg-against-950/60'} border border-surface-300 p-3 space-y-1.5`}>
                  {Array.from({ length: msg.lines }).map((_, j) => (
                    <Skeleton key={j} className={`h-4 rounded ${j === msg.lines - 1 && msg.lines > 1 ? 'w-3/4' : 'w-full'}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
