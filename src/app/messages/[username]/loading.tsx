import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ConversationLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
        {/* Partner header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-300 bg-surface-100 flex-shrink-0">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {[
            { align: 'left', w1: 'w-56', w2: 'w-40' },
            { align: 'right', w1: 'w-44', w2: '' },
            { align: 'left', w1: 'w-64', w2: 'w-52' },
            { align: 'right', w1: 'w-32', w2: '' },
            { align: 'left', w1: 'w-48', w2: 'w-36' },
            { align: 'right', w1: 'w-60', w2: '' },
          ].map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.align === 'left' && <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-1" />}
              <div className="space-y-1 max-w-[75%]">
                <Skeleton className={`h-9 ${msg.w1} rounded-2xl`} />
                {msg.w2 && <Skeleton className={`h-9 ${msg.w2} rounded-2xl`} />}
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Message input */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-surface-300 bg-surface-100">
          <div className="flex items-center gap-2">
            <Skeleton className="flex-1 h-10 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
