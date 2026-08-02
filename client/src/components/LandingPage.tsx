import { useCallback, useEffect, useState } from 'react'
import { Faq } from '../landing/Faq'
import { Home } from '../landing/Home'
import { Pricing } from '../landing/Pricing'
import { LandingFooter, LandingNav } from '../landing/shared'
import type { LandingPath } from '../landing/shared'

interface LandingPageProps {
  onSignIn: () => void
  onGetStarted: () => void
}

function isLandingPath(p: string): p is LandingPath {
  return p === '/' || p === '/pricing' || p === '/faq'
}

export function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  const [path, setPath] = useState<LandingPath>(() =>
    isLandingPath(window.location.pathname) ? window.location.pathname : '/',
  )

  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname
      if (isLandingPath(p)) setPath(p)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((to: LandingPath) => {
    window.history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-[#07070c] text-white">
      <LandingNav path={path} go={go} onSignIn={onSignIn} onGetStarted={onGetStarted} />
      {path === '/' && <Home onSignIn={onSignIn} onGetStarted={onGetStarted} />}
      {path === '/pricing' && <Pricing onGetStarted={onGetStarted} />}
      {path === '/faq' && <Faq />}
      <LandingFooter go={go} />
    </div>
  )
}
