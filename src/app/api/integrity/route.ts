import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') ?? 'overview'
  const severity = searchParams.get('severity') ?? 'all'
  const resolved = searchParams.get('resolved') ?? 'false'

  const supabase = await createClient()

  if (tab === 'overview') {
    // Last 30 days of health snapshots
    const { data: snapshots, error } = await supabase
      .from('integrity_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: true })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Current active signal counts by severity
    const { data: severityCounts } = await supabase
      .from('integrity_signals')
      .select('severity')
      .eq('resolved', false)

    const counts = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const row of severityCounts ?? []) {
      counts[row.severity as keyof typeof counts]++
    }

    const latest = snapshots?.[snapshots.length - 1] ?? null

    return NextResponse.json({
      snapshots,
      activeSeverityCounts: counts,
      latestSnapshot: latest,
    })
  }

  if (tab === 'signals') {
    let query = supabase
      .from('integrity_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (severity !== 'all') {
      query = query.eq('severity', severity)
    }

    if (resolved !== 'all') {
      query = query.eq('resolved', resolved === 'true')
    }

    const { data: signals, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signals })
  }

  return NextResponse.json({ error: 'Unknown tab' }, { status: 400 })
}
