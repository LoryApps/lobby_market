import { Loader2, Network } from 'lucide-react'

export default function ThesisNetworkLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2 text-purple">
        <Network className="h-5 w-5" />
        <span className="text-sm font-mono text-surface-500">Thesis Network</span>
      </div>
      <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
      <p className="text-xs font-mono text-surface-600">Building network graph…</p>
    </div>
  )
}
