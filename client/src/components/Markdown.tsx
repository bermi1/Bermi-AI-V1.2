import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { evaluate } from 'mathjs'
import 'katex/dist/katex.min.css'

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-bermi">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code(props) {
            const { className, children } = props as { className?: string; children?: React.ReactNode }
            // A ```plot fenced block becomes an interactive graph.
            if (className?.includes('language-plot')) {
              return <PlotBlock source={String(children)} />
            }
            return <code className={className}>{children}</code>
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})

interface Curve {
  label: string
  points: { x: number; y: number }[]
}

// Parse a plot block: optional "# x: min..max" range line, then one expression
// in x per line (e.g. "y = x^2", "sin(x)"). Evaluates each safely with mathjs.
function buildCurves(source: string): { curves: Curve[]; xmin: number; xmax: number; error: string | null } {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let xmin = -10
  let xmax = 10
  const exprs: string[] = []
  for (const line of lines) {
    const range = line.match(/^#\s*x\s*:\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)/i)
    if (range) {
      xmin = Number(range[1])
      xmax = Number(range[2])
      continue
    }
    if (line.startsWith('#')) continue
    exprs.push(line.replace(/^[a-zA-Z]\w*\s*=\s*/, '').replace(/\^/g, '^'))
  }
  if (xmax <= xmin) xmax = xmin + 1
  const N = 200
  const curves: Curve[] = []
  let error: string | null = null
  exprs.forEach((expr, i) => {
    const points: { x: number; y: number }[] = []
    let ok = false
    for (let k = 0; k <= N; k++) {
      const x = xmin + ((xmax - xmin) * k) / N
      try {
        const y = Number(evaluate(expr, { x }))
        if (Number.isFinite(y)) {
          points.push({ x, y })
          ok = true
        }
      } catch {
        /* skip invalid point */
      }
    }
    if (ok) curves.push({ label: lines.filter((l) => !l.startsWith('#'))[i] || expr, points })
    else error = `Couldn't plot "${expr}"`
  })
  return { curves, xmin, xmax, error }
}

const PLOT_COLORS = ['#3B2FBF', '#12b76a', '#f79009', '#f04438', '#7C6FF0']

function PlotBlock({ source }: { source: string }) {
  const { curves, xmin, xmax, error } = useMemo(() => buildCurves(source), [source])

  if (!curves.length) {
    return (
      <pre className="not-prose overflow-x-auto rounded-lg border border-edge bg-surface-sunken p-3 text-[12px] text-ink-muted">
        {error || 'plot'}
        {'\n'}
        {source.trim()}
      </pre>
    )
  }

  const W = 520
  const H = 300
  const pad = 34
  const ys = curves.flatMap((c) => c.points.map((p) => p.y))
  let ymin = Math.min(...ys)
  let ymax = Math.max(...ys)
  if (ymax - ymin < 1e-9) {
    ymin -= 1
    ymax += 1
  }
  const mx = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (W - 2 * pad)
  const my = (y: number) => H - pad - ((y - ymin) / (ymax - ymin)) * (H - 2 * pad)
  const x0 = xmin <= 0 && xmax >= 0 ? mx(0) : null
  const y0 = ymin <= 0 && ymax >= 0 ? my(0) : null

  return (
    <div className="not-prose my-3 overflow-x-auto rounded-xl border border-edge bg-surface-raised p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: W }}>
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="none" stroke="var(--edge)" />
        {y0 !== null && <line x1={pad} y1={y0} x2={W - pad} y2={y0} stroke="var(--edge-strong)" strokeWidth="1" />}
        {x0 !== null && <line x1={x0} y1={pad} x2={x0} y2={H - pad} stroke="var(--edge-strong)" strokeWidth="1" />}
        {[xmin, xmax].map((v, i) => (
          <text key={`x${i}`} x={i === 0 ? pad : W - pad} y={H - pad + 16} fontSize="10" fill="var(--ink-faint)" textAnchor={i === 0 ? 'start' : 'end'}>
            {Number(v.toFixed(2))}
          </text>
        ))}
        {[ymax, ymin].map((v, i) => (
          <text key={`y${i}`} x={pad - 6} y={i === 0 ? pad + 4 : H - pad} fontSize="10" fill="var(--ink-faint)" textAnchor="end">
            {Number(v.toFixed(2))}
          </text>
        ))}
        {curves.map((c, i) => (
          <polyline
            key={i}
            points={c.points.map((p) => `${mx(p.x)},${my(p.y)}`).join(' ')}
            fill="none"
            stroke={PLOT_COLORS[i % PLOT_COLORS.length]}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-3 px-1">
        {curves.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: PLOT_COLORS[i % PLOT_COLORS.length] }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}
