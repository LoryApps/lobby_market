export default function Loading() {
  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <p className="text-sm font-mono text-surface-500 tracking-widest uppercase">
          Convening…
        </p>
      </div>
    </div>
  )
}
