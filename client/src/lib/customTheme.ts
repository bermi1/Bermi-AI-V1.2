// "Any colour" theme: turns one chosen hex into a complete token set for the
// light or dark appearance, nudging lightness until text and buttons keep
// WCAG AA contrast (4.5:1). Pure functions, no DOM.

type RGB = [number, number, number]
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('')

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l * 100]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s * 100, l * 100]
}
function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
const hsl = (h: number, s: number, l: number) => toHex(hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100)))

function luminance([r, g, b]: RGB) {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Moves lightness (in `step` increments) until `colour` reaches `min` contrast against `bg`. */
function ensure(h: number, s: number, l: number, bg: string, min: number, step: number) {
  let c = hsl(h, s, l)
  for (let i = 0; i < 60 && contrast(c, bg) < min; i++) {
    l = clamp(l + step, 4, 96)
    c = hsl(h, s, l)
  }
  return c
}

export const CUSTOM_VARS = ['--primary', '--primary-hover', '--primary-soft', '--surface', '--surface-raised', '--surface-sunken', '--ink', '--ink-muted', '--ink-faint', '--edge', '--edge-strong', '--on-primary'] as const

export function customTokens(hex: string, mode: 'light' | 'dark'): Record<(typeof CUSTOM_VARS)[number], string> {
  const [h, s0, l0] = rgbToHsl(hexToRgb(isHex(hex) ? hex : '#3159EA'))
  const s = clamp(s0, 40, 92)
  if (mode === 'light') {
    const surface = hsl(h, 38, 98)
    const primary = ensure(h, s, Math.min(l0, 52), '#FFFFFF', 4.6, -2)
    return {
      '--primary': primary,
      '--primary-hover': ensure(h, s, rgbToHsl(hexToRgb(primary))[2] - 7, '#FFFFFF', 4.6, -2),
      '--primary-soft': hsl(h, clamp(s, 40, 85), 95),
      '--surface': surface,
      '--surface-raised': '#FFFFFF',
      '--surface-sunken': hsl(h, 30, 94),
      '--ink': hsl(h, 38, 13),
      '--ink-muted': ensure(h, 16, 40, surface, 5.2, -2),
      '--ink-faint': ensure(h, 12, 50, surface, 4.5, -2),
      '--edge': hsl(h, 28, 90),
      '--edge-strong': hsl(h, 24, 82),
      '--on-primary': contrast('#FFFFFF', primary) >= 4.5 ? '#FFFFFF' : '#0B1220',
    }
  }
  const surface = hsl(h, 36, 9)
  const primary = ensure(h, Math.min(s + 6, 95), Math.max(l0, 64), surface, 5, 2)
  return {
    '--primary': primary,
    '--primary-hover': hsl(h, Math.min(s + 6, 95), Math.min(rgbToHsl(hexToRgb(primary))[2] + 8, 90)),
    '--primary-soft': hsl(h, 42, 20),
    '--surface': surface,
    '--surface-raised': hsl(h, 30, 13),
    '--surface-sunken': hsl(h, 40, 6),
    '--ink': hsl(h, 60, 95),
    '--ink-muted': ensure(h, 18, 70, surface, 6, 2),
    '--ink-faint': ensure(h, 14, 56, surface, 4.5, 2),
    '--edge': hsl(h, 30, 18),
    '--edge-strong': hsl(h, 28, 26),
    '--on-primary': contrast('#0B1220', primary) >= 4.5 ? '#0B1220' : '#FFFFFF',
  }
}
