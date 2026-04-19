// Shared category colours used by both topic and law graph visualisations.
// Kept in its own module so the colour utilities can be statically imported
// by view wrappers without pulling in the heavy d3-force bundle.

export const GRAPH_CATEGORY_COLORS: Record<string, string> = {
  economics:   '#f59e0b', // gold
  politics:    '#60a5fa', // for-400
  technology:  '#8b5cf6', // purple
  science:     '#10b981', // emerald
  ethics:      '#f87171', // against-400
  philosophy:  '#818cf8', // indigo-400
  culture:     '#fb923c', // orange-400
  health:      '#f472b6', // pink-400
  environment: '#4ade80', // green-400
  education:   '#22d3ee', // cyan-400
}

const DEFAULT_COLOR = '#71717a' // surface-500

export function graphColorForCategory(category: string | null): string {
  if (!category) return DEFAULT_COLOR
  return GRAPH_CATEGORY_COLORS[category.toLowerCase()] ?? DEFAULT_COLOR
}
