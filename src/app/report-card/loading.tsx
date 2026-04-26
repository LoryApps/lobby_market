export default function ReportCardLoading() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-for-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-sm text-surface-500">Grading your civic record…</p>
      </div>
    </div>
  )
}
