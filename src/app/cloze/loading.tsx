import { Loader2 } from 'lucide-react'

export default function ClozeLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 text-surface-500 animate-spin" />
        <p className="text-sm font-mono text-surface-500">Loading puzzle…</p>
      </div>
    </div>
  )
}
