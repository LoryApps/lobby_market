import type { Metadata } from 'next'
import { GenomeClient } from './GenomeClient'

export const metadata: Metadata = {
  title: 'Civic Genome · Lobby Market',
  description:
    'Map the full sequence of your civic DNA. Every vote is a nucleotide — see which issue strands dominate, how your positions have evolved month by month, and what genome type your pattern represents.',
  openGraph: {
    title: 'Civic Genome · Lobby Market',
    description:
      'Your civic identity, decoded. See the strands, the sequence, and the evolution of your political DNA — built from every vote you\'ve cast on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Genome · Lobby Market',
    description:
      'Every vote you cast is a nucleotide in your civic DNA. Discover your genome type — Helical, Crystalline, Amorphous, or Mutant.',
  },
}

export default function GenomePage() {
  return <GenomeClient />
}
