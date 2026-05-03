import {
  BookOpen,
  Building2,
  Cpu,
  FlaskConical,
  Globe,
  Heart,
  Landmark,
  Scale,
  type LucideIcon,
} from 'lucide-react'

export type ArchetypeId =
  | 'pragmatist'
  | 'idealist'
  | 'guardian'
  | 'reformer'
  | 'libertarian'
  | 'communitarian'
  | 'technocrat'
  | 'democrat'

export interface ArchetypeConfig {
  id: ArchetypeId
  name: string
  tagline: string
  color: string        // Tailwind text-* class
  bgColor: string      // Tailwind bg-* class
  borderColor: string  // Tailwind border-* class
  icon: LucideIcon
}

export const ARCHETYPE_CONFIG: Record<ArchetypeId, ArchetypeConfig> = {
  pragmatist: {
    id: 'pragmatist',
    name: 'The Pragmatist',
    tagline: "What works matters more than what's pure.",
    color: 'text-for-400',
    bgColor: 'bg-for-500/10',
    borderColor: 'border-for-500/30',
    icon: Scale,
  },
  idealist: {
    id: 'idealist',
    name: 'The Idealist',
    tagline: 'Principles before compromise.',
    color: 'text-against-400',
    bgColor: 'bg-against-500/10',
    borderColor: 'border-against-500/30',
    icon: Heart,
  },
  guardian: {
    id: 'guardian',
    name: 'The Guardian',
    tagline: 'Stability is the foundation of progress.',
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/30',
    icon: Building2,
  },
  reformer: {
    id: 'reformer',
    name: 'The Reformer',
    tagline: 'The system can be fixed from within.',
    color: 'text-against-300',
    bgColor: 'bg-against-400/10',
    borderColor: 'border-against-400/30',
    icon: Landmark,
  },
  libertarian: {
    id: 'libertarian',
    name: 'The Libertarian',
    tagline: 'Freedom first, always.',
    color: 'text-purple',
    bgColor: 'bg-purple/10',
    borderColor: 'border-purple/30',
    icon: Globe,
  },
  communitarian: {
    id: 'communitarian',
    name: 'The Communitarian',
    tagline: 'Stronger together than apart.',
    color: 'text-emerald',
    bgColor: 'bg-emerald/10',
    borderColor: 'border-emerald/30',
    icon: BookOpen,
  },
  technocrat: {
    id: 'technocrat',
    name: 'The Technocrat',
    tagline: 'Data beats ideology every time.',
    color: 'text-for-300',
    bgColor: 'bg-for-400/10',
    borderColor: 'border-for-400/30',
    icon: Cpu,
  },
  democrat: {
    id: 'democrat',
    name: 'The Democrat',
    tagline: 'The will of the people is the only legitimate law.',
    color: 'text-for-500',
    bgColor: 'bg-for-600/10',
    borderColor: 'border-for-600/30',
    icon: FlaskConical,
  },
}

export const ARCHETYPE_IDS = Object.keys(ARCHETYPE_CONFIG) as ArchetypeId[]
