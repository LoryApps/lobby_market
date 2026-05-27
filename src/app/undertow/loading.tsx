import { Waves } from 'lucide-react'

export default function UndertowLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-surface-500">
        <Waves className="h-8 w-8 animate-pulse" />
        <p className="text-sm font-mono">Scanning for undertow signals…</p>
      </div>
    </div>
  )
}
