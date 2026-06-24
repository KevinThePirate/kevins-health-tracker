import Fuse from 'fuse.js'
import foodLookup from '../data/food_lookup.json'
import { ULCER_TRIGGERS } from '../data/ulcer_triggers'

let fuse = null
function getFuse() {
  if (!fuse) {
    fuse = new Fuse(foodLookup, {
      keys: ['name'],
      threshold: 0.4,   // 0 = exact, 1 = anything — 0.4 gives ~60% similarity
      includeScore: true,
    })
  }
  return fuse
}

export function parseFood(rawText) {
  if (!rawText?.trim()) return []

  const items = rawText
    .split(/,|\band\b/i)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  const f = getFuse()

  return items.map(item => {
    const results = f.search(item)
    const best = results[0]
    const matched = best && best.score < 0.4  // score 0 = perfect, score 1 = no match
    const calories = matched ? best.item.calories : null

    // Check ulcer risk
    const ulcer_risk = ULCER_TRIGGERS.some(trigger =>
      item.includes(trigger) || (matched && best.item.name.includes(trigger))
    )

    return {
      name: item,
      matched_name: matched ? best.item.name : null,
      calories,
      ulcer_risk,
    }
  })
}

export function totalCalories(parsed) {
  return parsed.reduce((sum, item) => sum + (item.calories || 0), 0)
}
