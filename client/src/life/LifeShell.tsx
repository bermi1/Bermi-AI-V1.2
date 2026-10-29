import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BookOpen, CalendarDays, GraduationCap, HeartPulse, LogOut, MessageSquare, Settings, Shield, Sparkles, Wallet } from 'lucide-react'
import { BermiMark } from '../components/Logo'
import { ThemeQuick } from '../components/ThemeQuick'
import { SettingsDialog } from '../components/SettingsDialog'
import * as api from '../lib/api'
import { useTheme } from '../lib/theme'
import type { AuthUser, ModelOption } from '../lib/types'
import { CompanionProvider, useCompanion, useCompanionShortcut } from './Companion'
import { ToastProvider, Skeleton, Sheet, ShellCtl } from './ui'

const MyDay = lazy(() => import('./MyDay').then((m) => ({ default: m.MyDay })))
const MyLearning = lazy(() => import('./MyLearning').then((m) => ({ default: m.MyLearning })))
const MyMoney = lazy(() => import('./MyMoney').then((m) => ({ default: m.MyMoney })))
const MyCycle = lazy(() => import('./MyCycle').then((m) => ({ default: m.MyCycle })))
const MyWellbeing = lazy(() => import('./MyWellbeing').then((m) => ({ default: m.MyWellbeing })))

export type LifeTab = 'day' | 'learning' | 'money' | 'wellbeing' | 'cycle'
export const TAB_PATH: Record<LifeTab, string> = { day: '/my/day', learning: '/my/learning', money: '/my/money', wellbeing: '/my/wellbeing', cycle: '/my/cycle' }

const TABS: { id: Exclude<LifeTab, 'cycle'>; label: string; icon: typeof CalendarDays }[] = [
  { id: 'day', label: 'My Day', icon: CalendarDays },
  { id: 'learning', label: 'My Learning', icon: BookOpen },
  { id: 'money', label: 'My Money', icon: Wallet },
  { id: 'wellbeing', label: 'My Wellbeing', icon: HeartPulse },
]

export function tabFromPath(path: string): LifeTab {
  if (path.startsWith('/my/learning')) return 'learning'
  if (path.startsWith('/my/money')) return 'money'
  if (path.startsWith('/my/wellbeing')) return 'wellbeing'
  if (path.startsWith('/my/cycle')) return 'cycle'
  return 'day'
}

interface Props {
  user: AuthUser
  tab: LifeTab
  go: (to: string) => void
  onSignedOut: () => void
}

export function LifeShell(props: Props) {
  return (
    <ToastProvider>
      <CompanionProvider
        onNavigate={props.go}
        onOpenChat={(text) => {
          if (text) {
            try {
              localStorage.setItem('bermi-chat-handoff', JSON.stringify({ prompt: text }))
            } catch {
              /* private mode — the chat just opens empty */
            }
          }
          props.go('/chat')
        }}
      >
        <Frame {...props} />
      </CompanionProvider>
    </ToastProvider>
  )
}

function Frame({ user, tab, go, onSignedOut }: Props) {
  const { open: openCompanion } = useCompanion()
  const { resolved } = useTheme()
  useCompanionShortcut()
  const [account, setAccount] = useState(false)
  const [settings, setSettings] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('bermi-model') || '')
  const [name, setName] = useState(user.name)

  useEffect(() => {
    api.adminMe().then((r) => setIsAdmin(r.isAdmin))
    api.getSettings().then((s) => setName(s.profile.name || user.name)).catch(() => {})
  }, [user.name])
  const loadModels = () =>
    api.listModels().then((l) => {
      setModels(l)
      setSelectedModel((cur) => (cur && l.some((m) => m.id === cur) ? cur : (l[0]?.id ?? '')))
    }).catch(() => {})
  useEffect(() => { loadModels() }, [])
  useEffect(() => { if (selectedModel) localStorage.setItem('bermi-model', selectedModel) }, [selectedModel])

  // Keep the document title meaningful per screen (screen readers + tab strip).
  useEffect(() => {
    const label = tab === 'cycle' ? 'Period tracker' : TABS.find((t) => t.id === tab)!.label
    document.title = `${label} · Bermi`
  }, [tab])

  const signOut = () => api.logout().finally(onSignedOut)

  return (
    <ShellCtl.Provider value={{ openAccount: () => setAccount(true), openChat: () => go('/chat') }}>
    <div className="min-h-dvh bg-surface text-ink" {...(tab === 'cycle' ? { 'data-accent': 'rose', 'data-theme': resolved } : {})}>
      <a href="#life-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>

      {/* Tablet + desktop: floating dark rail */}
      <aside className="dock fixed bottom-3 left-3 top-3 z-30 hidden w-[72px] flex-col rounded-[2rem] px-2.5 py-5 md:flex xl:w-[228px] xl:px-3.5">
        <button onClick={() => go('/my/day')} className="mb-7 flex items-center gap-3 rounded-2xl px-1.5 xl:px-2" aria-label="Bermi home">
          <BermiMark size={38} className="shrink-0 text-white" />
          <span className="hidden text-[19px] font-semibold tracking-tight text-white xl:inline">Bermi</span>
        </button>
        <nav aria-label="Primary" className="flex flex-col gap-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <RailLink key={id} active={tab === id || (id === 'wellbeing' && tab === 'cycle')} onClick={() => go(TAB_PATH[id])} icon={<Icon size={20} />} label={label} />
          ))}
        </nav>
        <button
          onClick={() => openCompanion()}
          className="glow-btn mt-6 flex min-h-[48px] items-center justify-center gap-2 rounded-full px-3 text-[14px] font-semibold transition-transform active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Ask Bermi"
        >
          <Sparkles size={19} /> <span className="hidden xl:inline">Ask Bermi</span>
        </button>
        <p className="mt-auto hidden px-3 pb-3 text-[11.5px] leading-snug text-white/45 xl:block">Your life better organized, your potential better supported.</p>
        <div className="mt-auto flex flex-col gap-1.5 xl:mt-0">
          <RailLink onClick={() => go('/chat')} icon={<MessageSquare size={20} />} label="Full chat" />
          <RailLink onClick={() => setAccount(true)} icon={<Settings size={20} />} label={name || 'Account'} />
        </div>
      </aside>

      <div className="min-w-0 md:pl-[96px] xl:pl-[252px]">
        {user.is_guest && (
          <div className="bg-primary-soft px-4 py-1.5 text-center text-[12.5px] text-primary">
            You’re using Bermi as a guest — free for one day.{' '}
            <button onClick={signOut} className="font-semibold underline underline-offset-2">Create a free account to keep your work</button>
          </div>
        )}

        <main id="life-main" tabIndex={-1} className="mx-auto w-full max-w-[1080px] px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-5 outline-none md:px-6 md:pb-14 md:pt-4 lg:pr-8">
          <Suspense fallback={<ScreenSkeleton />}>
            {tab === 'day' && <MyDay user={user} name={name} />}
            {tab === 'learning' && <MyLearning go={go} />}
            {tab === 'money' && <MyMoney />}
            {tab === 'wellbeing' && <MyWellbeing go={go} />}
            {tab === 'cycle' && <MyCycle go={go} />}
          </Suspense>
        </main>
      </div>

      {/* Phone: floating pill dock, the assistant at its heart */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
        <ul className="dock grid h-[58px] w-full max-w-[380px] grid-cols-5 items-center rounded-full px-2">
          <BarItem tab={TABS[0]} active={tab === 'day'} onClick={() => go(TAB_PATH.day)} />
          <BarItem tab={TABS[1]} active={tab === 'learning'} onClick={() => go(TAB_PATH.learning)} />
          <li className="flex justify-center">
            <button
              onClick={() => openCompanion()}
              aria-label="Ask Bermi"
              className="glow-btn grid h-[46px] w-[46px] place-items-center rounded-full transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Sparkles size={21} />
            </button>
          </li>
          <BarItem tab={TABS[2]} active={tab === 'money'} onClick={() => go(TAB_PATH.money)} />
          <BarItem tab={TABS[3]} active={tab === 'wellbeing' || tab === 'cycle'} onClick={() => go(TAB_PATH.wellbeing)} />
        </ul>
      </nav>

      <Sheet open={account} onClose={() => setAccount(false)} title={name || 'Account'}>
        <ThemeQuick />
        <div className="space-y-1">
          <MenuRow icon={<Settings size={18} />} label="Settings & appearance" onClick={() => { setAccount(false); setSettings(true) }} />
          <MenuRow icon={<MessageSquare size={18} />} label="Full chat" onClick={() => { setAccount(false); go('/chat') }} />
          <MenuRow icon={<GraduationCap size={18} />} label="Learning portal" onClick={() => { setAccount(false); go('/portal') }} />
          {isAdmin && <MenuRow icon={<Shield size={18} />} label="Bermi Control" onClick={() => { setAccount(false); go('/admin') }} />}
          <MenuRow icon={<LogOut size={18} />} label="Sign out" onClick={signOut} />
        </div>
        <p className="mt-4 text-center text-[12px] text-ink-faint">Your life better organized, your potential better supported.</p>
      </Sheet>

      {settings && (
        <SettingsDialog
          onClose={() => setSettings(false)}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onModelsChanged={loadModels}
          onProfileSaved={(p) => setName(p.name || user.name)}
          onSignOut={signOut}
        />
      )}
    </div>
    </ShellCtl.Provider>
  )
}

function RailLink({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`flex min-h-[48px] items-center justify-center gap-3 rounded-full px-3 text-[14.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white xl:justify-start xl:px-4 ${
        active ? 'bg-white text-[#0B1020]' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden truncate xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </button>
  )
}

function BarItem({ tab, active, onClick }: { tab: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <li className="flex justify-center">
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        aria-label={tab.label}
        title={tab.label}
        className={`grid h-[44px] w-[44px] place-items-center rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${active ? 'bg-white text-[#0B1020] shadow-[0_6px_18px_rgb(0_0_0/0.35)]' : 'text-white/70 hover:text-white'}`}
      >
        <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
      </button>
    </li>
  )
}

function MenuRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[14.5px] font-medium hover:bg-surface-sunken">
      <span className="text-ink-muted">{icon}</span>
      {label}
    </button>
  )
}

function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-6 h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
