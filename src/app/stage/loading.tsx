import { MonitorPlay } from 'lucide-react'

export default function StageLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <MonitorPlay className="h-10 w-10 text-for-400 animate-pulse" />
        <div className="space-y-2 w-64">
          <div className="h-3 rounded-full bg-surface-300/50 animate-pulse" />
          <div className="h-3 rounded-full bg-surface-300/50 animate-pulse w-3/4 mx-auto" />
        </div>
      </div>
    </div>
  )
}
