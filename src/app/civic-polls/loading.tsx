import { BarChart2 } from 'lucide-react'

export default function CivicPollsLoading() {
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-surface-500">
        <BarChart2 className="h-7 w-7 animate-pulse" />
        <span className="text-sm font-mono">Loading polls…</span>
      </div>
    </div>
  )
}
