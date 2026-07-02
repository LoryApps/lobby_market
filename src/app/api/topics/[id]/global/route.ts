import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegionStance = 'majority_for' | 'majority_against' | 'contested' | 'neutral'

export interface CountryData {
  code: string
  name: string
  stance: RegionStance
  supportPct: number       // 0–100 estimated public support
  policyStatus: string     // e.g. 'Enacted 2019', 'Rejected 2021', 'Under debate'
  note: string             // brief context sentence
  flag: string             // emoji flag
  trend: 'rising' | 'falling' | 'stable'
}

export interface WorldRegion {
  id: string
  name: string
  stance: RegionStance
  supportPct: number
  countries: CountryData[]
  summary: string
  keyDevelopment: string
}

export interface GlobalContextResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  globalSupportPct: number
  globalLabel: string
  globalInsight: string
  alignmentScore: number       // 0–100 how close Lobby's FOR% is to global support%
  alignmentLabel: string
  regions: WorldRegion[]
  leadingCountries: CountryData[]      // top FOR countries
  opposingCountries: CountryData[]     // top AGAINST countries
  trendDirection: 'towards_support' | 'towards_opposition' | 'stable'
  trendReason: string
}

// ─── Seeded pseudo-random ─────────────────────────────────────────────────────

function seededRng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  let state = h >>> 0
  return function next(min: number, max: number): number {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    const r = state / 0xffffffff
    return Math.round(min + r * (max - min))
  }
}

// ─── Regional data pools by category ─────────────────────────────────────────

interface RegionTemplate {
  id: string
  name: string
  countries: {
    code: string
    name: string
    flag: string
    baseSupportByCategory: Record<string, number>  // category -> base support pct
    defaultSupport: number
  }[]
  baseSupportByCategory: Record<string, number>
  defaultSupport: number
}

const REGION_TEMPLATES: RegionTemplate[] = [
  {
    id: 'north_america',
    name: 'North America',
    baseSupportByCategory: {
      Politics: 52, Economics: 55, Technology: 68, Science: 65, Ethics: 50,
      Philosophy: 48, Culture: 54, Health: 62, Environment: 58, Education: 63,
    },
    defaultSupport: 55,
    countries: [
      { code: 'US', name: 'United States', flag: '🇺🇸',
        baseSupportByCategory: { Politics: 50, Economics: 54, Technology: 72, Science: 61, Ethics: 49, Philosophy: 47, Culture: 52, Health: 60, Environment: 55, Education: 62 },
        defaultSupport: 54 },
      { code: 'CA', name: 'Canada', flag: '🇨🇦',
        baseSupportByCategory: { Politics: 58, Economics: 57, Technology: 66, Science: 70, Ethics: 55, Philosophy: 52, Culture: 58, Health: 67, Environment: 64, Education: 68 },
        defaultSupport: 60 },
      { code: 'MX', name: 'Mexico', flag: '🇲🇽',
        baseSupportByCategory: { Politics: 48, Economics: 52, Technology: 60, Science: 58, Ethics: 46, Philosophy: 44, Culture: 53, Health: 56, Environment: 52, Education: 55 },
        defaultSupport: 52 },
    ],
  },
  {
    id: 'western_europe',
    name: 'Western Europe',
    baseSupportByCategory: {
      Politics: 58, Economics: 54, Technology: 65, Science: 72, Ethics: 60,
      Philosophy: 62, Culture: 60, Health: 70, Environment: 70, Education: 68,
    },
    defaultSupport: 62,
    countries: [
      { code: 'DE', name: 'Germany', flag: '🇩🇪',
        baseSupportByCategory: { Politics: 60, Economics: 55, Technology: 68, Science: 75, Ethics: 62, Philosophy: 65, Culture: 58, Health: 72, Environment: 74, Education: 70 },
        defaultSupport: 65 },
      { code: 'FR', name: 'France', flag: '🇫🇷',
        baseSupportByCategory: { Politics: 57, Economics: 52, Technology: 63, Science: 70, Ethics: 58, Philosophy: 66, Culture: 62, Health: 68, Environment: 69, Education: 67 },
        defaultSupport: 63 },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧',
        baseSupportByCategory: { Politics: 55, Economics: 53, Technology: 66, Science: 71, Ethics: 58, Philosophy: 60, Culture: 57, Health: 70, Environment: 66, Education: 66 },
        defaultSupport: 62 },
      { code: 'SE', name: 'Sweden', flag: '🇸🇪',
        baseSupportByCategory: { Politics: 65, Economics: 58, Technology: 70, Science: 78, Ethics: 66, Philosophy: 64, Culture: 65, Health: 76, Environment: 79, Education: 74 },
        defaultSupport: 68 },
    ],
  },
  {
    id: 'eastern_europe',
    name: 'Eastern Europe',
    baseSupportByCategory: {
      Politics: 44, Economics: 48, Technology: 56, Science: 58, Ethics: 42,
      Philosophy: 44, Culture: 44, Health: 52, Environment: 50, Education: 56,
    },
    defaultSupport: 48,
    countries: [
      { code: 'PL', name: 'Poland', flag: '🇵🇱',
        baseSupportByCategory: { Politics: 42, Economics: 46, Technology: 55, Science: 56, Ethics: 40, Philosophy: 43, Culture: 42, Health: 50, Environment: 48, Education: 55 },
        defaultSupport: 47 },
      { code: 'HU', name: 'Hungary', flag: '🇭🇺',
        baseSupportByCategory: { Politics: 38, Economics: 44, Technology: 52, Science: 54, Ethics: 36, Philosophy: 40, Culture: 40, Health: 48, Environment: 45, Education: 52 },
        defaultSupport: 44 },
      { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿',
        baseSupportByCategory: { Politics: 48, Economics: 50, Technology: 60, Science: 62, Ethics: 46, Philosophy: 48, Culture: 48, Health: 56, Environment: 54, Education: 60 },
        defaultSupport: 52 },
    ],
  },
  {
    id: 'east_asia',
    name: 'East Asia',
    baseSupportByCategory: {
      Politics: 42, Economics: 60, Technology: 72, Science: 70, Ethics: 48,
      Philosophy: 52, Culture: 44, Health: 65, Environment: 58, Education: 72,
    },
    defaultSupport: 56,
    countries: [
      { code: 'JP', name: 'Japan', flag: '🇯🇵',
        baseSupportByCategory: { Politics: 45, Economics: 58, Technology: 74, Science: 72, Ethics: 50, Philosophy: 54, Culture: 46, Health: 68, Environment: 62, Education: 74 },
        defaultSupport: 58 },
      { code: 'KR', name: 'South Korea', flag: '🇰🇷',
        baseSupportByCategory: { Politics: 48, Economics: 62, Technology: 76, Science: 74, Ethics: 52, Philosophy: 56, Culture: 50, Health: 66, Environment: 60, Education: 76 },
        defaultSupport: 60 },
      { code: 'CN', name: 'China', flag: '🇨🇳',
        baseSupportByCategory: { Politics: 38, Economics: 60, Technology: 68, Science: 68, Ethics: 44, Philosophy: 50, Culture: 40, Health: 62, Environment: 54, Education: 70 },
        defaultSupport: 54 },
    ],
  },
  {
    id: 'south_asia',
    name: 'South Asia',
    baseSupportByCategory: {
      Politics: 46, Economics: 50, Technology: 58, Science: 56, Ethics: 44,
      Philosophy: 48, Culture: 46, Health: 52, Environment: 50, Education: 60,
    },
    defaultSupport: 50,
    countries: [
      { code: 'IN', name: 'India', flag: '🇮🇳',
        baseSupportByCategory: { Politics: 46, Economics: 52, Technology: 60, Science: 58, Ethics: 44, Philosophy: 50, Culture: 47, Health: 54, Environment: 52, Education: 62 },
        defaultSupport: 52 },
      { code: 'PK', name: 'Pakistan', flag: '🇵🇰',
        baseSupportByCategory: { Politics: 40, Economics: 46, Technology: 52, Science: 50, Ethics: 38, Philosophy: 44, Culture: 40, Health: 46, Environment: 44, Education: 52 },
        defaultSupport: 45 },
      { code: 'BD', name: 'Bangladesh', flag: '🇧🇩',
        baseSupportByCategory: { Politics: 44, Economics: 48, Technology: 54, Science: 52, Ethics: 42, Philosophy: 46, Culture: 44, Health: 50, Environment: 48, Education: 56 },
        defaultSupport: 48 },
    ],
  },
  {
    id: 'latin_america',
    name: 'Latin America',
    baseSupportByCategory: {
      Politics: 50, Economics: 52, Technology: 58, Science: 56, Ethics: 48,
      Philosophy: 50, Culture: 54, Health: 56, Environment: 54, Education: 60,
    },
    defaultSupport: 53,
    countries: [
      { code: 'BR', name: 'Brazil', flag: '🇧🇷',
        baseSupportByCategory: { Politics: 48, Economics: 52, Technology: 58, Science: 56, Ethics: 46, Philosophy: 50, Culture: 54, Health: 56, Environment: 54, Education: 60 },
        defaultSupport: 53 },
      { code: 'AR', name: 'Argentina', flag: '🇦🇷',
        baseSupportByCategory: { Politics: 52, Economics: 50, Technology: 56, Science: 58, Ethics: 50, Philosophy: 52, Culture: 56, Health: 58, Environment: 56, Education: 62 },
        defaultSupport: 55 },
      { code: 'CL', name: 'Chile', flag: '🇨🇱',
        baseSupportByCategory: { Politics: 54, Economics: 54, Technology: 60, Science: 60, Ethics: 52, Philosophy: 54, Culture: 56, Health: 60, Environment: 58, Education: 64 },
        defaultSupport: 57 },
    ],
  },
  {
    id: 'africa',
    name: 'Africa',
    baseSupportByCategory: {
      Politics: 44, Economics: 48, Technology: 52, Science: 50, Ethics: 42,
      Philosophy: 44, Culture: 46, Health: 52, Environment: 50, Education: 56,
    },
    defaultSupport: 48,
    countries: [
      { code: 'ZA', name: 'South Africa', flag: '🇿🇦',
        baseSupportByCategory: { Politics: 50, Economics: 52, Technology: 56, Science: 56, Ethics: 48, Philosophy: 50, Culture: 52, Health: 56, Environment: 54, Education: 60 },
        defaultSupport: 52 },
      { code: 'NG', name: 'Nigeria', flag: '🇳🇬',
        baseSupportByCategory: { Politics: 42, Economics: 46, Technology: 50, Science: 48, Ethics: 40, Philosophy: 42, Culture: 44, Health: 48, Environment: 46, Education: 52 },
        defaultSupport: 46 },
      { code: 'ET', name: 'Ethiopia', flag: '🇪🇹',
        baseSupportByCategory: { Politics: 40, Economics: 44, Technology: 48, Science: 46, Ethics: 38, Philosophy: 40, Culture: 42, Health: 46, Environment: 44, Education: 50 },
        defaultSupport: 44 },
    ],
  },
  {
    id: 'middle_east',
    name: 'Middle East',
    baseSupportByCategory: {
      Politics: 40, Economics: 50, Technology: 56, Science: 52, Ethics: 36,
      Philosophy: 40, Culture: 36, Health: 50, Environment: 46, Education: 54,
    },
    defaultSupport: 46,
    countries: [
      { code: 'AE', name: 'UAE', flag: '🇦🇪',
        baseSupportByCategory: { Politics: 44, Economics: 58, Technology: 64, Science: 58, Ethics: 40, Philosophy: 44, Culture: 40, Health: 58, Environment: 52, Education: 60 },
        defaultSupport: 52 },
      { code: 'IL', name: 'Israel', flag: '🇮🇱',
        baseSupportByCategory: { Politics: 48, Economics: 54, Technology: 68, Science: 65, Ethics: 50, Philosophy: 52, Culture: 46, Health: 62, Environment: 58, Education: 65 },
        defaultSupport: 56 },
      { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦',
        baseSupportByCategory: { Politics: 34, Economics: 46, Technology: 52, Science: 46, Ethics: 30, Philosophy: 34, Culture: 30, Health: 44, Environment: 40, Education: 48 },
        defaultSupport: 40 },
    ],
  },
  {
    id: 'oceania',
    name: 'Oceania',
    baseSupportByCategory: {
      Politics: 56, Economics: 54, Technology: 66, Science: 70, Ethics: 58,
      Philosophy: 60, Culture: 58, Health: 68, Environment: 68, Education: 66,
    },
    defaultSupport: 61,
    countries: [
      { code: 'AU', name: 'Australia', flag: '🇦🇺',
        baseSupportByCategory: { Politics: 56, Economics: 54, Technology: 66, Science: 72, Ethics: 58, Philosophy: 60, Culture: 58, Health: 68, Environment: 70, Education: 67 },
        defaultSupport: 62 },
      { code: 'NZ', name: 'New Zealand', flag: '🇳🇿',
        baseSupportByCategory: { Politics: 62, Economics: 58, Technology: 68, Science: 76, Ethics: 64, Philosophy: 64, Culture: 62, Health: 72, Environment: 74, Education: 70 },
        defaultSupport: 66 },
    ],
  },
]

// ─── Policy status by stance ──────────────────────────────────────────────────

function policyStatus(supportPct: number, seed: number): string {
  if (supportPct >= 70) {
    const statuses = ['Enacted', 'National law since', 'Fully implemented since', 'Codified']
    return statuses[seed % statuses.length]
  }
  if (supportPct >= 55) {
    const statuses = ['Under active debate', 'Pilot programs running', 'Partial legislation passed', 'Regional adoption']
    return statuses[seed % statuses.length]
  }
  if (supportPct >= 45) {
    const statuses = ['Contested', 'Mixed public opinion', 'Stalled in legislature', 'Under committee review']
    return statuses[seed % statuses.length]
  }
  const statuses = ['Rejected by legislature', 'No active proposals', 'Opposed by majority', 'Politically blocked']
  return statuses[seed % statuses.length]
}

// ─── Note templates by category ───────────────────────────────────────────────

function generateNote(category: string | null, country: string, supportPct: number, rng: (a: number, b: number) => number): string {
  const cat = category ?? 'General'
  const leaning = supportPct >= 60 ? 'strong public support' : supportPct >= 50 ? 'moderate acceptance' : supportPct >= 40 ? 'divided public opinion' : 'majority opposition'

  const templates: Record<string, string[]> = {
    Economics: [
      `${country} shows ${leaning}, with business groups and unions split on fiscal impact.`,
      `Economic modelling in ${country} suggests mixed outcomes, leading to ${leaning}.`,
      `${country}'s policy trajectory reflects ${leaning} tied to labour market conditions.`,
    ],
    Technology: [
      `${country}'s digital policy framework has led to ${leaning} for this kind of regulation.`,
      `Tech sector lobbying in ${country} has shaped ${leaning} among legislators.`,
      `${country}'s innovation agenda reflects ${leaning} with regulatory concerns emerging.`,
    ],
    Environment: [
      `Climate commitments in ${country} translate to ${leaning} for environmental policies.`,
      `${country}'s environmental lobby is influential, resulting in ${leaning}.`,
      `Green party influence in ${country} contributes to ${leaning} on this issue.`,
    ],
    Health: [
      `${country}'s healthcare system structure leads to ${leaning} in public health debates.`,
      `Medical associations in ${country} have taken positions reflecting ${leaning}.`,
      `Public health outcomes in ${country} drive ${leaning} for this policy direction.`,
    ],
    Politics: [
      `${country}'s political landscape produces ${leaning}, with coalition dynamics in play.`,
      `Electoral pressures in ${country} create ${leaning} around governance reform.`,
      `${country}'s constitutional framework aligns with ${leaning} for this debate.`,
    ],
    Education: [
      `${country}'s education ministry reflects ${leaning} shaped by academic stakeholders.`,
      `Teacher unions and parent groups in ${country} show ${leaning}.`,
      `Education reform discourse in ${country} generates ${leaning}.`,
    ],
    Science: [
      `Scientific consensus in ${country} drives ${leaning} among evidence-based policymakers.`,
      `Research institutions in ${country} support ${leaning} backed by data.`,
      `${country}'s science funding priorities reinforce ${leaning}.`,
    ],
    Culture: [
      `Cultural values in ${country} generate ${leaning} on social policy questions.`,
      `${country}'s media landscape reflects ${leaning} in public discourse.`,
      `Social movements in ${country} have produced ${leaning} through civic pressure.`,
    ],
    Ethics: [
      `Ethical frameworks prevalent in ${country} align with ${leaning}.`,
      `Religious and secular voices in ${country} produce ${leaning} on values questions.`,
      `${country}'s civic institutions reflect ${leaning} on ethical policy debates.`,
    ],
    Philosophy: [
      `Philosophical traditions in ${country} contribute to ${leaning} on foundational questions.`,
      `Academic and public discourse in ${country} reflects ${leaning}.`,
      `${country}'s historical experience shapes ${leaning} on this debate.`,
    ],
  }

  const pool = templates[cat] ?? templates.Politics
  return pool[rng(0, pool.length - 1)]
}

// ─── Stance classifier ────────────────────────────────────────────────────────

function classifyStance(supportPct: number): RegionStance {
  if (supportPct >= 58) return 'majority_for'
  if (supportPct <= 42) return 'majority_against'
  if (supportPct >= 48 && supportPct <= 52) return 'contested'
  return 'neutral'
}

// ─── Trend from topic vote split ─────────────────────────────────────────────

function deriveTrend(supportPct: number): 'rising' | 'falling' | 'stable' {
  if (supportPct >= 65) return 'rising'
  if (supportPct <= 35) return 'falling'
  return 'stable'
}

// ─── Region summary templates ─────────────────────────────────────────────────

function regionSummary(region: string, stance: RegionStance, _supportPct: number): string {
  if (stance === 'majority_for') return `${region} broadly supports this position, with most countries having adopted similar policies or actively pursuing them.`
  if (stance === 'majority_against') return `${region} leans against this direction, with historical or cultural factors creating resistance to related policies.`
  if (stance === 'contested') return `${region} is deeply divided, with countries in the region taking opposing approaches and public opinion closely split.`
  return `${region} shows mixed signals — some countries are moving towards adoption while others remain neutral or cautious.`
}

function regionKeyDevelopment(region: string, category: string | null): string {
  const cat = category ?? 'general'
  const devs: Record<string, Record<string, string>> = {
    north_america: {
      Economics: 'Debates over fiscal policy have intensified following post-pandemic economic realignment.',
      Technology: 'Federal and state-level tech regulation frameworks are diverging across the region.',
      Environment: 'Climate legislation momentum has accelerated after major weather events.',
      Politics: 'Electoral reform discussions are reshaping governance debates across the continent.',
      default: 'Regional policy convergence has been tested by diverging national priorities.',
    },
    western_europe: {
      Economics: 'EU fiscal rules reform has brought this debate to the forefront of bloc-wide policy.',
      Technology: 'The Digital Services Act has set a global precedent, influencing national approaches.',
      Environment: 'Green Deal commitments have accelerated policy adoption across member states.',
      Health: 'Post-pandemic healthcare reform has generated broad regional consensus.',
      default: 'EU coordination mechanisms are driving convergence on this policy area.',
    },
    east_asia: {
      Technology: 'Regional tech competition has prompted accelerated adoption of forward-looking policies.',
      Economics: 'Supply chain realignment is reshaping economic policy priorities across the region.',
      default: 'Strategic competition between regional powers is influencing policy direction.',
    },
    africa: {
      Economics: 'Continental Free Trade Area implementation is driving economic policy alignment.',
      Environment: 'Climate vulnerability is pushing adaptation-focused policy across the continent.',
      default: 'AU-led frameworks are creating cross-border policy coordination opportunities.',
    },
    latin_america: {
      Economics: 'Regional economic volatility has elevated debates over structural reform.',
      Environment: 'Amazon protection has become a regional diplomatic flashpoint.',
      default: 'Democratic consolidation and economic development are shaping the policy landscape.',
    },
    middle_east: {
      Economics: 'Vision 2030-style reform agendas are driving policy modernization in the Gulf.',
      Technology: 'AI and smart city investments are creating new regulatory frameworks.',
      default: 'Economic diversification ambitions are reshaping traditional policy stances.',
    },
    south_asia: {
      Technology: 'Digital infrastructure expansion has catalysed technology governance debates.',
      Environment: 'Energy transition planning is at the centre of policy development.',
      default: 'Rapid development pressures are creating complex policy trade-offs.',
    },
    eastern_europe: {
      Politics: 'EU membership obligations and democratic backsliding tensions define the policy space.',
      default: 'Geopolitical pressures and EU alignment requirements are shaping policy positions.',
    },
    oceania: {
      Environment: 'Pacific Island climate vulnerability has generated strong regional consensus for action.',
      default: 'Strategic partnerships with larger powers are influencing domestic policy directions.',
    },
  }
  const regionDevs = devs[region] ?? {}
  return regionDevs[cat] ?? regionDevs['default'] ?? `Policy momentum in this region is being shaped by structural economic and social changes.`
}

// ─── Global insight ───────────────────────────────────────────────────────────

function globalInsight(globalPct: number, category: string | null, lobbyPct: number): string {
  const cat = category ?? 'this area'
  const diff = Math.abs(globalPct - lobbyPct)
  const alignment = diff < 10 ? 'closely mirrors' : diff < 25 ? 'broadly aligns with' : 'diverges significantly from'

  if (globalPct >= 65) {
    return `Global momentum strongly favours this direction in ${cat}. The Lobby Market community's position ${alignment} the worldwide trend, with most developed democracies having enacted or actively pursuing similar policies.`
  }
  if (globalPct >= 55) {
    return `A majority of nations support this direction in ${cat}, though significant variation exists by region. The Lobby community ${alignment} the global average, with emerging economies and democracies generally supportive.`
  }
  if (globalPct >= 45) {
    return `The world is divided on this ${cat} question. No clear global consensus has formed, with developed and developing nations often taking different approaches. The Lobby community ${alignment} the contested global median.`
  }
  return `Global opinion in ${cat} leans against this position, though significant minority movements exist. The Lobby community ${alignment} the international trend, which has been shaped by economic, cultural, and historical factors.`
}

// ─── Alignment score ──────────────────────────────────────────────────────────

function alignmentScore(lobbyPct: number, globalPct: number): number {
  const diff = Math.abs(lobbyPct - globalPct)
  return Math.max(0, 100 - Math.round(diff * 1.5))
}

function alignmentLabel(score: number, lobbyPct: number, globalPct: number): string {
  if (score >= 85) return 'Closely Aligned'
  if (score >= 65) return lobbyPct > globalPct ? 'Lobby Leans More FOR' : 'Lobby Leans More AGAINST'
  if (score >= 45) return lobbyPct > globalPct ? 'Lobby More Supportive' : 'Lobby More Opposed'
  return lobbyPct > globalPct ? 'Lobby Strongly More FOR' : 'Lobby Strongly More AGAINST'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const category = topic.category as string | null
  const lobbyPct = Math.round(topic.blue_pct ?? 50)
  const rng = seededRng(topicId)

  // Build regional data
  const regions: WorldRegion[] = REGION_TEMPLATES.map((rt) => {
    const baseSupport = rt.baseSupportByCategory[category ?? ''] ?? rt.defaultSupport
    // Add seeded variance (+/- 8) per region
    const regionSupport = Math.min(95, Math.max(10, baseSupport + rng(-8, 8)))
    const regionStance = classifyStance(regionSupport)

    const countries: CountryData[] = rt.countries.map((c) => {
      const base = c.baseSupportByCategory[category ?? ''] ?? c.defaultSupport
      const cs = Math.min(95, Math.max(10, base + rng(-10, 10)))
      const seed = rng(0, 3)
      return {
        code: c.code,
        name: c.name,
        flag: c.flag,
        stance: classifyStance(cs),
        supportPct: cs,
        policyStatus: policyStatus(cs, seed),
        note: generateNote(category, c.name, cs, rng),
        trend: deriveTrend(cs + rng(-5, 5)),
      }
    })

    return {
      id: rt.id,
      name: rt.name,
      stance: regionStance,
      supportPct: regionSupport,
      countries,
      summary: regionSummary(rt.name, regionStance, regionSupport),
      keyDevelopment: regionKeyDevelopment(rt.id, category),
    }
  })

  // Global average
  const totalWeight = regions.reduce((s, r) => s + r.countries.length, 0)
  const weightedSum = regions.reduce((s, r) => {
    return s + r.countries.reduce((cs, c) => cs + c.supportPct, 0)
  }, 0)
  const globalSupportPct = Math.round(weightedSum / totalWeight)

  const globalLabel =
    globalSupportPct >= 65 ? 'Global Majority FOR' :
    globalSupportPct >= 55 ? 'Lean FOR Worldwide' :
    globalSupportPct >= 45 ? 'Globally Contested' :
    globalSupportPct >= 35 ? 'Lean AGAINST Worldwide' :
    'Global Majority AGAINST'

  // Leading and opposing countries
  const allCountries = regions.flatMap((r) => r.countries)
  const leadingCountries = [...allCountries]
    .filter((c) => c.supportPct >= 60)
    .sort((a, b) => b.supportPct - a.supportPct)
    .slice(0, 5)
  const opposingCountries = [...allCountries]
    .filter((c) => c.supportPct <= 40)
    .sort((a, b) => a.supportPct - b.supportPct)
    .slice(0, 5)

  const trendDirection: 'towards_support' | 'towards_opposition' | 'stable' =
    globalSupportPct >= 55 ? 'towards_support' :
    globalSupportPct <= 45 ? 'towards_opposition' :
    'stable'

  const trendReasons: Record<string, string> = {
    towards_support: `Growing international consensus is building in ${category ?? 'this area'}, driven by shared challenges and cross-border policy learning.`,
    towards_opposition: `Resistance is growing globally in ${category ?? 'this area'}, with economic pressures and political headwinds slowing adoption.`,
    stable: `The global balance of opinion remains largely unchanged, with entrenched positions on both sides limiting major shifts.`,
  }

  const response: GlobalContextResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    globalSupportPct,
    globalLabel,
    globalInsight: globalInsight(globalSupportPct, category, lobbyPct),
    alignmentScore: alignmentScore(lobbyPct, globalSupportPct),
    alignmentLabel: alignmentLabel(alignmentScore(lobbyPct, globalSupportPct), lobbyPct, globalSupportPct),
    regions,
    leadingCountries,
    opposingCountries,
    trendDirection,
    trendReason: trendReasons[trendDirection],
  }

  return NextResponse.json(response)
}
