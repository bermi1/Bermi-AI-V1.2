import { useId } from 'react'
import { ACCENT_META, useOptionalTheme, type Accent } from '../lib/theme'
import { MARK } from '../lib/brand'

const Shapes = () => (
  <>
    <path d={MARK.stem} />
    <path fillRule="evenodd" d={MARK.bowl} />
    <path d={MARK.spark} />
  </>
)

/**
 * The Bermi mark: a rounded "b" whose bowl is a ring, with a four-point spark
 * above it (the assistant). Renders in currentColor so it adapts to context.
 */
export function BermiMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} fill="currentColor" aria-hidden focusable="false">
      <Shapes />
    </svg>
  )
}

/** The mark in the chosen icon colour (soft gradient), with no tile around it.
 * Uses the colour picked in Settings unless `accent` is given. */
export function BermiTile({ size = 32, className, accent }: { size?: number; className?: string; accent?: Accent }) {
  const id = useId()
  const theme = useOptionalTheme()
  const m = ACCENT_META[accent ?? theme?.prefs.icon ?? 'blue']
  return (
    <svg viewBox="40 40 440 460" width={size} height={(size * 460) / 440} className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="170" y1="60" x2="400" y2="480">
          <stop offset="0" stopColor={m.from} />
          <stop offset="1" stopColor={m.icon} />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}g)`}>
        <Shapes />
      </g>
    </svg>
  )
}
