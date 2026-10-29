import { addDays, type CycleData, type Item } from './api'

// Plain averages of what the person logged. Nothing here is medical advice,
// a fertility measure or contraception guidance — predictions are estimates.

const dayNum = (ymd: string) => Math.floor(new Date(`${ymd}T12:00:00Z`).getTime() / 86_400_000)
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a)

export interface CycleInfo {
  starts: string[]
  cycleLengths: number[]
  periodLengths: number[]
  avgCycle: number
  avgPeriod: number
  fromHistory: boolean
  lastStart: string | null
  nextStart: string | null
  ovulation: string | null
  range: [number, number] | null
  periodDays: Set<string>
  predictedDays: Set<string>
  flow: Map<string, CycleData['flow']>
}

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

export function analyse(items: Item<CycleData>[], defaults: { cycle: number; period: number }): CycleInfo {
  const starts = [...new Set(items.filter((i) => i.data.kind === 'period_start').map((i) => i.data.date))].sort()
  const ends = items.filter((i) => i.data.kind === 'period_end').map((i) => i.data.date).sort()
  const cycleLengths = starts.slice(1).map((d, i) => daysBetween(starts[i], d)).filter((g) => g >= 15 && g <= 60)
  const periodLengths = starts
    .map((s) => {
      const e = ends.find((x) => x >= s && daysBetween(s, x) <= 14)
      return e ? daysBetween(s, e) + 1 : null
    })
    .filter((x): x is number => x != null)
  const recent = cycleLengths.slice(-6)
  const avgCycle = recent.length ? avg(recent) : defaults.cycle
  const avgPeriod = periodLengths.length ? avg(periodLengths.slice(-6)) : defaults.period
  const lastStart = starts[starts.length - 1] ?? null
  const nextStart = lastStart ? addDays(lastStart, avgCycle) : null
  const flow = new Map<string, CycleData['flow']>()
  for (const i of items) if (i.data.kind === 'log' && i.data.flow) flow.set(i.data.date, i.data.flow)

  const periodDays = new Set<string>()
  for (const s of starts) {
    const e = ends.find((x) => x >= s && daysBetween(s, x) <= 14)
    const len = e ? daysBetween(s, e) + 1 : avgPeriod
    for (let k = 0; k < len; k++) periodDays.add(addDays(s, k))
  }
  for (const [d, f] of flow) if (f && f !== 'spotting') periodDays.add(d)

  const predictedDays = new Set<string>()
  if (nextStart) for (let k = 0; k < avgPeriod; k++) predictedDays.add(addDays(nextStart, k))
  return {
    starts, cycleLengths, periodLengths, avgCycle, avgPeriod, fromHistory: recent.length > 0, lastStart, nextStart,
    ovulation: nextStart ? addDays(nextStart, -14) : null,
    range: cycleLengths.length >= 2 ? [Math.min(...cycleLengths.slice(-6)), Math.max(...cycleLengths.slice(-6))] : null,
    periodDays, predictedDays, flow,
  }
}

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
export function phaseOf(dayInCycle: number, info: CycleInfo): Phase {
  const ov = Math.max(info.avgCycle - 14, info.avgPeriod + 3)
  if (dayInCycle <= info.avgPeriod) return 'menstrual'
  if (dayInCycle < ov - 1) return 'follicular'
  if (dayInCycle <= ov + 1) return 'ovulation'
  return 'luteal'
}

export const PHASES: { id: Phase; label: string; blurb: string }[] = [
  { id: 'menstrual', label: 'Menstrual', blurb: 'Bleeding days. Energy often dips — rest, warmth and iron-rich food help some people feel better.' },
  { id: 'follicular', label: 'Follicular', blurb: 'After bleeding, before the middle of the cycle. Many people notice energy and mood lifting.' },
  { id: 'ovulation', label: 'Ovulation (estimate)', blurb: 'Around the middle of a typical cycle. This is a rough estimate from averages, not a test.' },
  { id: 'luteal', label: 'Luteal', blurb: 'The days before the next period. Some people notice tiredness, bloating or mood changes.' },
]
