import { Skeleton } from '@/components/ui/Skeleton'

export default function LawChatLoading() {
  return (
    <div className="flex flex-col h-screen bg-surface-50">
      {/* Header skeleton */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>

      {/* Message skeletons */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-4">
          {[false, true, false, false, true, false].map((isSelf, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isSelf && <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />}
              <div className={`flex flex-col gap-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                {!isSelf && <Skeleton className="h-3 w-20 ml-1" />}
                <Skeleton
                  className="h-9 rounded-2xl"
                  style={{ width: `${140 + (i * 37) % 100}px` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input skeleton */}
      <div className="flex-shrink-0 border-t border-surface-300 bg-surface-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Skeleton className="flex-1 h-11 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}
