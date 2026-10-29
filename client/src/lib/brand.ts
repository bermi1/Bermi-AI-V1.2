// Bermi mark, drawn once and reused everywhere (app tile, inline mark,
// favicon, generated PNG icons). A rounded "b" whose bowl is a ring, with a
// four-point spark above it — the spark is the assistant.
export const MARK = {
  stem: 'M151 103a37 37 0 0 1 74 0V320H151Z',
  bowl: 'M306 165a155 155 0 1 0 0 310a155 155 0 0 0 0-310zm0 74a81 81 0 1 1 0 162a81 81 0 0 1 0-162z',
  // Concave four-point star centred on (408,116), radius 56.
  spark: 'M408 60C413 100 424 111 464 116C424 121 413 132 408 172C403 132 392 121 352 116C392 111 403 100 408 60Z',
}

export const markShapesSvg = (fill: string) =>
  `<g fill="${fill}"><path d="${MARK.stem}"/><path fill-rule="evenodd" d="${MARK.bowl}"/><path d="${MARK.spark}"/></g>`

/** Self-contained tile SVG (used for the favicon and exported icons). */
export const tileSvg = (from: string, to: string, opts: { radius?: number; scale?: number } = {}) => {
  const r = opts.radius ?? 118
  const s = opts.scale ?? 1
  const t = s === 1 ? '' : ` transform="translate(256 267) scale(${s}) translate(-256 -267)"`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>` +
    `<radialGradient id="h" cx=".28" cy=".18" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="512" height="512" rx="${r}" fill="url(#g)"/><rect width="512" height="512" rx="${r}" fill="url(#h)"/>` +
    `<g${t}>${markShapesSvg('#fff')}</g></svg>`
  )
}

/** The mark on its own — no tile — in a soft vertical gradient (favicon, in-app logo). */
export const freeMarkSvg = (from: string, to: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 40 440 460"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="170" y1="60" x2="400" y2="480"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>${markShapesSvg('url(#g)')}</svg>`
