import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthPage } from './components/AuthPage'
import { LandingPage } from './components/LandingPage'
import { Welcome } from './components/Welcome'
import { VerifyEmailPage } from './components/VerifyEmailPage'
import { BermiMark } from './components/Logo'
import { PrefsSync } from './lib/theme'
import { LifeShell, tabFromPath } from './life/LifeShell'
import * as api from './lib/api'
import type { AuthUser } from './lib/types'

const Workspace = lazy(() => import('./components/Workspace'))
const LearnPortal = lazy(() => import('./learn/LearnPortal').then((m) => ({ default: m.LearnPortal })))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))

const Splash = () => (
  <div className="flex h-dvh items-center justify-center bg-surface"><Loader2 size={20} className="animate-spin text-ink-faint" /></div>
)

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [verificationRequired, setVerificationRequired] = useState(false)
  // Signed-out front door: a short intro slider, then sign in / sign up.
  const [screen, setScreen] = useState<'welcome' | 'login' | 'signup'>(() => (new URLSearchParams(window.location.search).has('auth_error') ? 'login' : 'welcome'))

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { user, verificationRequired } = await api.authMe()
      setUser(user)
      setVerificationRequired(verificationRequired)
      return true
    } catch {
      setUser(null)
      return false
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    // Google sign-in lands with the session token in the URL fragment so it
    // works even where the cookie was blocked.
    const match = window.location.hash.match(/bermi_token=([a-f0-9]+)/)
    if (match) {
      api.setSessionToken(match[1])
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    checkAuth()
  }, [checkAuth])

  const signOut = useCallback(() => {
    api.logout().finally(() => setUser(null))
  }, [])

  if (!authChecked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface">
        <BermiMark size={48} className="text-primary" />
        <Loader2 size={18} className="animate-spin text-ink-faint" />
      </div>
    )
  }

  if (!user) {
    // /pricing and /faq stay reachable (and prerendered) for search; everything
    // else starts at the intro slider.
    const p = window.location.pathname
    if ((p === '/pricing' || p === '/faq') && screen === 'welcome') {
      return <LandingPage onSignIn={() => setScreen('login')} onGetStarted={() => setScreen('signup')} />
    }
    if (screen === 'welcome') return <Welcome onSignIn={() => setScreen('login')} onGetStarted={() => setScreen('signup')} />
    return <AuthPage key={screen} initialView={screen} onAuthed={checkAuth} onBack={() => setScreen('welcome')} />
  }

  if (verificationRequired && !user.email_verified) {
    return <VerifyEmailPage user={user} onVerified={setUser} onSignOut={signOut} />
  }

  return (
    <>
      <PrefsSync />
      <Router user={user} onSignedOut={() => setUser(null)} />
    </>
  )
}

// Routes: `/` and `/my/*` are the Life OS (My Day / Learning / Money / Wellbeing);
// `/chat` is the full chat workspace; `/portal` is the learning portal and
// `/admin` Bermi Control. We watch the pathname so entering/leaving a
// destination swaps the whole shell.
function Router({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((to: string) => {
    window.history.pushState(null, '', to)
    setPath(to.split('?')[0])
    window.scrollTo(0, 0)
  }, [])

  if (path.startsWith('/portal') || path.startsWith('/learn')) {
    return <Suspense fallback={<Splash />}><LearnPortal user={user} onExit={() => go('/chat')} /></Suspense>
  }
  if (path.startsWith('/admin')) {
    return <Suspense fallback={<Splash />}><AdminDashboard onExit={() => go('/')} selfEmail={user.email} /></Suspense>
  }
  // Returning from a connector OAuth flow lands on `/?connected=…`; that opens
  // Settings inside the chat workspace.
  const search = window.location.search
  const connectorReturn = /[?&](connected|connector_error)=?/.test(search)
  if (path.startsWith('/chat') || connectorReturn) {
    return <Suspense fallback={<Splash />}><Workspace user={user} onSignedOut={onSignedOut} onHome={() => go('/my/day')} /></Suspense>
  }
  return <LifeShell user={user} tab={tabFromPath(path)} go={go} onSignedOut={onSignedOut} />
}

