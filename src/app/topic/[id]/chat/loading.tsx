import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'

export default function TopicChatLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden pb-16 md:pb-0">
        {/* Topic header */}
        <div className="px-4 py-3 border-b border-surface-300 bg-surface-100 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded mt-1" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {[
            { avatar: true, lines: 2, own: false },
            { avatar: true, lines: 1, own: true },
            { avatar: true, lines: 3, own: false },
            { avatar: true, lines: 1, own: true },
            { avatar: true, lines: 2, own: false },
          ].map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.own ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.avatar && !msg.own && <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />}
              <div className="max-w-[80%] space-y-1">
                {!msg.own && <Skeleton className="h-3 w-24 rounded" />}
                {Array.from({ length: msg.lines }).map((_, j) => (
                  <Skeleton
                    key={j}
                    className={`h-8 rounded-2xl ${j === msg.lines - 1 && msg.lines > 1 ? 'w-3/4' : 'w-full'}`}
                    style={{ width: `${Math.floor(Math.random() * 40 + 60)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
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
