import type { Metadata } from 'next'
import { PerformanceClient } from './PerformanceClient'

export const metadata: Metadata = {
  title: 'Prediction Performance · Lobby Market Exchange',
  description: 'Analyse your forecasting accuracy with Brier Score, calibration curves, and win-rate breakdowns.',
}

export default function PerformancePage() {
  return <PerformanceClient />
}
