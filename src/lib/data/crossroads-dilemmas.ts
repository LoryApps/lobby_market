export interface CrossroadsDilemma {
  id: string
  week: number
  title: string
  scenario: string
  valueA: string
  descA: string
  colorA: string
  valueB: string
  descB: string
  colorB: string
  quote: string
  quoteAuthor: string
}

export const DILEMMAS: CrossroadsDilemma[] = [
  {
    id: 'freedom-vs-safety',
    week: 0,
    title: 'The First Crossroads',
    scenario:
      'A new technology can predict crime with 94% accuracy — but requires continuous surveillance of every citizen. The government proposes mandatory rollout to eliminate violent crime.',
    valueA: 'Freedom',
    descA: 'Privacy and autonomy are inviolable. No state surveillance, even for safety.',
    colorA: 'for',
    valueB: 'Safety',
    descB: 'Preventing harm justifies monitoring. 94% fewer victims is worth the trade-off.',
    colorB: 'against',
    quote: 'Those who would give up essential liberty to purchase a little temporary safety deserve neither.',
    quoteAuthor: 'Benjamin Franklin',
  },
  {
    id: 'growth-vs-earth',
    week: 1,
    title: 'The Second Crossroads',
    scenario:
      'A major industrial project would create 200,000 jobs and lift millions out of poverty — but will permanently destroy one of the last pristine ecosystems on Earth.',
    valueA: 'Prosperity',
    descA: 'Human welfare comes first. Economic development saves lives today.',
    colorA: 'gold',
    valueB: 'Planet',
    descB: 'The ecosystem is irreplaceable. Future generations have equal claim to the Earth.',
    colorB: 'emerald',
    quote: 'We do not inherit the earth from our ancestors; we borrow it from our children.',
    quoteAuthor: 'Antoine de Saint-Exupéry',
  },
  {
    id: 'equality-vs-merit',
    week: 2,
    title: 'The Third Crossroads',
    scenario:
      'Society can be restructured for perfect equality of outcome — everyone receives the same resources regardless of effort — or pure meritocracy, where rewards exactly match contribution.',
    valueA: 'Equality',
    descA: 'No person deserves less dignity. Equal outcomes create a just society.',
    colorA: 'for',
    valueB: 'Merit',
    descB: 'Rewarding effort creates incentives. The best outcomes come from earned rewards.',
    colorB: 'purple',
    quote: 'The only way to make men love one another is to make men equal.',
    quoteAuthor: 'John Rawls',
  },
  {
    id: 'tradition-vs-progress',
    week: 3,
    title: 'The Fourth Crossroads',
    scenario:
      'A rapid social reform will dramatically improve quality of life for marginalized groups — but requires dismantling institutions that have provided stability for centuries.',
    valueA: 'Tradition',
    descA: 'Proven institutions are hard to rebuild. Change must be gradual and tested.',
    colorA: 'gold',
    valueB: 'Progress',
    descB: 'Institutions that harm people have no right to persist. Change is moral duty.',
    colorB: 'for',
    quote: 'The measure of intelligence is the ability to change.',
    quoteAuthor: 'Albert Einstein',
  },
  {
    id: 'local-vs-global',
    week: 4,
    title: 'The Fifth Crossroads',
    scenario:
      'A global crisis can only be solved by surrendering significant national sovereignty to an unelected international body with enforcement powers over all member nations.',
    valueA: 'Sovereignty',
    descA: 'Nations must remain self-governing. Democratic legitimacy requires local control.',
    colorA: 'against',
    valueB: 'Unity',
    descB: 'Existential problems need global solutions. Some sovereignty is worth sacrificing.',
    colorB: 'for',
    quote: 'Nationalism is an infantile thing. It is the measles of mankind.',
    quoteAuthor: 'Albert Einstein',
  },
  {
    id: 'privacy-vs-transparency',
    week: 5,
    title: 'The Sixth Crossroads',
    scenario:
      'Full government transparency — every official communication, budget item, and decision made public in real time — but citizens also lose all digital privacy in return.',
    valueA: 'Privacy',
    descA: 'Personal data is a right. The state has no claim on private life.',
    colorA: 'for',
    valueB: 'Transparency',
    descB: 'Democracy requires radical openness. Both citizens and governments must be visible.',
    colorB: 'purple',
    quote: 'The right to be left alone is the most comprehensive of rights and the right most valued by civilized men.',
    quoteAuthor: 'Justice Louis Brandeis',
  },
  {
    id: 'justice-vs-mercy',
    week: 6,
    title: 'The Seventh Crossroads',
    scenario:
      'The justice system can be reformed to focus entirely on rehabilitation with no punitive sentences — or return to strict deterrence-based sentencing with minimal rehabilitation.',
    valueA: 'Justice',
    descA: 'Actions have consequences. Deterrence protects society through accountability.',
    colorA: 'against',
    valueB: 'Mercy',
    descB: 'People can change. A society judged by how it treats its worst members.',
    colorB: 'emerald',
    quote: 'The quality of mercy is not strained; it droppeth as the gentle rain from heaven.',
    quoteAuthor: 'William Shakespeare',
  },
  {
    id: 'democracy-vs-expertise',
    week: 7,
    title: 'The Eighth Crossroads',
    scenario:
      'Complex policy decisions (climate, pandemics, economics) could be delegated entirely to verified expert panels — eliminating democratic vote but ensuring scientifically optimal outcomes.',
    valueA: 'Democracy',
    descA: 'Every voice must count. Technocracy without consent is tyranny.',
    colorA: 'for',
    valueB: 'Expertise',
    descB: 'Some questions have correct answers. Let those who know best decide.',
    colorB: 'purple',
    quote: 'The best argument against democracy is a five-minute conversation with the average voter.',
    quoteAuthor: 'Winston Churchill',
  },
]

function getWeekNumber(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
}

export function getCurrentDilemma(): CrossroadsDilemma {
  const week = getWeekNumber()
  const index = week % DILEMMAS.length
  return { ...DILEMMAS[index], week }
}
