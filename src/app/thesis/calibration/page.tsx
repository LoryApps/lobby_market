import type { Metadata } from 'next'
import { CalibrationClient } from './CalibrationClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Thesis Calibration · Lobby Market',
  description:
    'How well does community agreement predict thesis vindication? Calibration curves, confidence rankings, and expiring predictions across every civic category.',
  openGraph: {
    title: 'Thesis Calibration · Lobby Market',
    description:
      'When 80% of the Lobby agrees on a thesis, how often does it come true? The calibration engine maps community confidence to historical vindication rates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Calibration · Lobby Market',
    description:
      'How accurate is the crowd? See how community thesis confidence maps to actual vindication rates across every civic category.',
  },
}

export default function ThesisCalibrationPage() {
  return <CalibrationClient />
}
