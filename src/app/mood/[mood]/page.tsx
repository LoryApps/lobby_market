import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MoodTopicsClient } from './MoodTopicsClient'

export const dynamic = 'force-dynamic'

type MoodKind =
  | 'hopeful' | 'inspired' | 'proud' | 'determined'
  | 'frustrated' | 'worried' | 'angry' | 'relieved'

const MOOD_META: Record<MoodKind, { emoji: string; label: string; desc: string }> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    desc: 'Topics that make the Lobby feel optimistic about the future.' },
  inspired:   { emoji: '✨', label: 'Inspired',   desc: 'Debates that spark ideas and elevate civic imagination.' },
  proud:      { emoji: '🏆', label: 'Proud',      desc: 'Issues where the community celebrates hard-won progress.' },
  determined: { emoji: '💪', label: 'Determined', desc: 'The fights worth having — where conviction drives debate.' },
  frustrated: { emoji: '😤', label: 'Frustrated', desc: 'Topics that reveal tensions and unmet expectations.' },
  worried:    { emoji: '😟', label: 'Worried',    desc: 'Debates that surface real concerns about where things are headed.' },
  angry:      { emoji: '😡', label: 'Angry',      desc: 'The debates that ignite the strongest negative reactions.' },
  relieved:   { emoji: '😌', label: 'Relieved',   desc: 'Topics where the outcome — or progress — brings welcome relief.' },
}

const VALID_MOODS = new Set(Object.keys(MOOD_META))

interface Props {
  params: { mood: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!VALID_MOODS.has(params.mood)) return { title: 'Mood · Lobby Market' }
  const { emoji, label, desc } = MOOD_META[params.mood as MoodKind]
  const title = `${emoji} ${label} Topics · Lobby Market`
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description: desc,
    },
  }
}

export default function MoodTopicsPage({ params }: Props) {
  if (!VALID_MOODS.has(params.mood)) notFound()
  return <MoodTopicsClient mood={params.mood as MoodKind} />
}
