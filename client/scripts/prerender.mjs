// Runs after `vite build` (see package.json). Bakes the real, rendered
// markup for the public marketing pages (Home, Pricing, FAQ) into static
// HTML files in dist/ — so an AI crawler or search engine that only fetches
// raw HTML (most of them: GPTBot, ClaudeBot, PerplexityBot, CCBot, Googlebot
// in its non-rendering pass, etc.) sees the actual page content instead of
// an empty <div id="root">. The browser is unaffected: main.tsx uses
// createRoot (not hydrateRoot), so React just renders on top of this exactly
// as it always has — no hydration-mismatch risk from server/client markup
// differing.
import { build } from 'vite'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const ssrOutDir = path.join(root, '.ssr-tmp')

const PAGES = [
  {
    path: '/',
    outFile: path.join(distDir, 'index.html'),
    title: 'From Conversation to Real Mastery',
    description:
      'Bermi AI is the complete AI learning powerhouse — turn any chat or document into a structured, mastery-gated learning path. Build custom AI brains, publish courses as an institution, and track real, measurable competence.',
  },
  {
    path: '/pricing',
    outFile: path.join(distDir, 'pricing', 'index.html'),
    title: 'Pricing',
    description:
      "See what's included with Bermi AI — full AI chat, mastery-gated courses, gamified Study Mode, and institution publishing with live learner analytics.",
  },
  {
    path: '/faq',
    outFile: path.join(distDir, 'faq', 'index.html'),
    title: 'Frequently Asked Questions',
    description:
      'Answers on getting started, how Bermi differs from ChatGPT and other AI tutors, mastery gating, institution publishing, learner analytics, and data privacy.',
  },
]

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html not found — run `vite build` before prerendering.')
  }

  await build({
    root,
    build: {
      ssr: 'src/entry-server.tsx',
      outDir: '.ssr-tmp',
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'entry-server.mjs' } },
    },
    logLevel: 'warn',
  })

  const modUrl = path.join(ssrOutDir, 'entry-server.mjs')
  const { render, faqGroups } = await import(`file://${modUrl}?t=${Date.now()}`)

  const shell = await readFile(path.join(distDir, 'index.html'), 'utf-8')

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqGroups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    ),
  }

  for (const page of PAGES) {
    const appHtml = render(page.path)
    const fullTitle = `${page.title} — Bermi AI`
    const canonicalUrl = `https://bermiai.com${page.path === '/' ? '/' : page.path}`
    const desc = escapeAttr(page.description)

    let html = shell
      .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
      .replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonicalUrl}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeAttr(fullTitle)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonicalUrl}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeAttr(fullTitle)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`)

    if (page.path === '/faq') {
      html = html.replace(
        '</head>',
        `  <script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>\n  </head>`,
      )
    }

    await mkdir(path.dirname(page.outFile), { recursive: true })
    await writeFile(page.outFile, html, 'utf-8')
    console.log(`prerendered ${page.path} -> ${path.relative(root, page.outFile)}`)
  }

  await rm(ssrOutDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
