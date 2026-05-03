import { MonitorPlay } from 'lucide-react'

export default function StageIdLoading() {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <MonitorPlay className="h-12 w-12 text-for-400 animate-pulse" />
        <p className="text-surface-500 font-mono text-sm">Loading stage…</p>
      </div>
    </div>
  )
}
