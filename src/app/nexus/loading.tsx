export default function NexusLoading() {
  return (
    <div className="h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-purple border-t-transparent animate-spin" />
        <p className="text-sm font-mono text-surface-500">Loading Civic Nexus…</p>
      </div>
    </div>
  )
}
