// Server-side rendering entry for the public marketing pages only (Home,
// Pricing, FAQ) — used exclusively by scripts/prerender.mjs at build time,
// never shipped to the browser. Renders the exact same components the SPA
// uses, so AI crawlers and search engines (which mostly fetch raw HTML and
// never run JavaScript) get the real page content instead of an empty
// <div id="root">. React then re-renders on top of this in the browser as
// it always has (main.tsx uses createRoot, not hydrateRoot, so there is no
// hydration-mismatch concern).
import { renderToString } from 'react-dom/server'
import { Home } from './landing/Home'
import { Pricing } from './landing/Pricing'
import { Faq, faqGroups } from './landing/Faq'
import { LandingFooter, LandingNav } from './landing/shared'
import type { LandingPath } from './landing/shared'

// Re-exported so scripts/prerender.mjs (plain Node, can't import .tsx
// directly) can build the FAQPage JSON-LD from the same data useJsonLd
// renders client-side, instead of hand-duplicating the question list.
export { faqGroups }

const noop = () => {}

function Page({ path }: { path: LandingPath }) {
  return (
    <div className="min-h-dvh bg-[#07070c] text-white">
      <LandingNav path={path} go={noop} onSignIn={noop} onGetStarted={noop} />
      {path === '/' && <Home onSignIn={noop} onGetStarted={noop} />}
      {path === '/pricing' && <Pricing onGetStarted={noop} />}
      {path === '/faq' && <Faq />}
      <LandingFooter go={noop} />
    </div>
  )
}

export function render(path: LandingPath): string {
  return renderToString(<Page path={path} />)
}
