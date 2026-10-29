// Generated focus sounds. Nothing is downloaded or licensed: each "scene" is
// shaped noise produced locally with the Web Audio API. They're offered as a
// background some people find helpful for concentration — no health claims.

export type SceneId = 'brown' | 'rain' | 'air'
export const SCENES: { id: SceneId; name: string; hint: string }[] = [
  { id: 'brown', name: 'Deep hush', hint: 'Low, soft rumble' },
  { id: 'rain', name: 'Light rain', hint: 'Gentle, bright patter' },
  { id: 'air', name: 'Soft air', hint: 'Smooth, steady airflow' },
]

let ctx: AudioContext | null = null
let nodes: { src: AudioBufferSourceNode; gain: GainNode; lfo?: OscillatorNode } | null = null

function noiseBuffer(c: AudioContext, kind: 'white' | 'brown') {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w * 0.5
    else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  // Short crossfade so the loop point doesn't click.
  const fade = Math.floor(c.sampleRate * 0.05)
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t
  }
  return buf
}

export const soundscapeSupported = () => typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)

export function startScene(id: SceneId, volume: number) {
  stopScene()
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = ctx ?? new AC()
  void ctx.resume()
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, id === 'brown' ? 'brown' : 'white')
  src.loop = true
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  gain.gain.value = 0
  let lfo: OscillatorNode | undefined
  if (id === 'brown') {
    filter.type = 'lowpass'
    filter.frequency.value = 520
  } else if (id === 'rain') {
    filter.type = 'bandpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.5
  } else {
    filter.type = 'lowpass'
    filter.frequency.value = 1100
    // Very slow swell so it breathes rather than droning.
    lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 0.08
    depth.gain.value = 250
    lfo.connect(depth).connect(filter.frequency)
    lfo.start()
  }
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start()
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2)
  nodes = { src, gain, lfo }
}

export function setVolume(v: number) {
  if (ctx && nodes) nodes.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.1)
}

export function stopScene() {
  if (!ctx || !nodes) return
  const { src, gain, lfo } = nodes
  nodes = null
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setTargetAtTime(0, t, 0.2)
  setTimeout(() => {
    try {
      src.stop()
      lfo?.stop()
    } catch {
      /* already stopped */
    }
  }, 900)
}
