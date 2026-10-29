import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BookOpen, CalendarDays, GraduationCap, HeartPulse, LogOut, MessageSquare, Settings, Shield, Sparkles, Wallet } from 'lucide-react'
import { BermiMark } from '../components/Logo'
import { SettingsDialog } from '../components/SettingsDialog'
import * as api from '../lib/api'
import type { AuthUser, ModelOption } from '../lib/types'
import { CompanionProvider, useCompanion, useCompanionShortcut } from './Companion'
import { ToastProvider, Skeleton, Sheet, btn } from './ui'

const MyDay = lazy(() => import('./MyDay').then((m) => ({ default: m.MyDay })))
const MyLearning = lazy(() => import('./MyLearning').then((m) => ({ default: m.MyLearning })))
const MyMoney = lazy(() => import('./MyMoney').then((m) => ({ default: m.MyMoney })))
const MyWellbeing = lazy(() => import('./MyWellbeing').then((m) => ({ default: m.MyWellbeing })))

export type LifeTab = 'day' | 'learning' | 'money' | 'wellbeing'
export const TAB_PATH: Record<LifeTab, string> = { day: '/my/day', learning: '/my/learning', money: '/my/money', wellbeing: '/my/wellbeing' }

const TABS: { id: LifeTab; label: string; icon: typeof CalendarDays }[] = [
  { id: 'day', label: 'My Day', icon: CalendarDays },
  { id: 'learning', label: 'My Learning', icon: BookOpen },
  { id: 'money', label: 'My Money', icon: Wallet },
  { id: 'wellbeing', label: 'My Wellbeing', icon: HeartPulse },
]

export function tabFromPath(path: string): LifeTab {
  if (path.startsWith('/my/learning')) return 'learning'
  if (path.startsWith('/my/money')) return 'money'
  if (path.startsWith('/my/wellbeing')) return 'wellbeing'
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
    const label = TABS.find((t) => t.id === tab)!.label
    document.title = `${label} · Bermi`
  }, [tab])

  const signOut = () => api.logout().finally(onSignedOut)

  return (
    <div className="flex min-h-dvh bg-surface text-ink">
      <a href="#life-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>

      {/* Tablet + desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-edge px-3 py-5 md:flex xl:w-[236px] xl:px-4">
        <button onClick={() => go('/my/day')} className="mb-6 flex items-center gap-2.5 rounded-xl px-1.5 py-1 xl:px-2" aria-label="Bermi home">
          <BermiMark size={30} className="shrink-0 text-primary" />
          <span className="hidden text-[17px] font-semibold tracking-tight xl:inline">Bermi</span>
        </button>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <RailLink key={id} active={tab === id} onClick={() => go(TAB_PATH[id])} icon={<Icon size={20} />} label={label} />
          ))}
        </nav>
        <button
          onClick={() => openCompanion()}
          className="mt-5 flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[14px] font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Ask Bermi"
        >
          <Sparkles size={18} /> <span className="hidden xl:inline">Ask Bermi</span>
        </button>
        <div className="mt-auto flex flex-col gap-1">
          <RailLink onClick={() => go('/chat')} icon={<MessageSquare size={20} />} label="Full chat" />
          <RailLink onClick={() => setAccount(true)} icon={<Settings size={20} />} label={name || 'Account'} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-edge bg-surface/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <BermiMark size={26} className="text-primary" />
            <span className="text-[16px] font-semibold tracking-tight">Bermi</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => go('/chat')} className={btn.icon} aria-label="Open full chat"><MessageSquare size={20} /></button>
            <button onClick={() => setAccount(true)} className={btn.icon} aria-label="Account and settings"><Settings size={20} /></button>
          </div>
        </header>

        {user.is_guest && (
          <div className="bg-primary-soft px-4 py-1.5 text-center text-[12.5px] text-primary">
            You’re using Bermi as a guest — free for one day.{' '}
            <button onClick={signOut} className="font-semibold underline underline-offset-2">Create a free account to keep your work</button>
          </div>
        )}

        <main id="life-main" tabIndex={-1} className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-5 outline-none md:px-8 md:pb-16 md:pt-9">
          <Suspense fallback={<ScreenSkeleton />}>
            {tab === 'day' && <MyDay user={user} name={name} />}
            {tab === 'learning' && <MyLearning go={go} />}
            {tab === 'money' && <MyMoney />}
            {tab === 'wellbeing' && <MyWellbeing />}
          </Suspense>
        </main>

        {/* Phone bottom bar with the assistant integrated in the centre */}
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <ul className="mx-auto grid h-[62px] max-w-md grid-cols-5 items-stretch">
            <BarItem tab={TABS[0]} active={tab === 'day'} onClick={() => go(TAB_PATH.day)} short="Day" />
            <BarItem tab={TABS[1]} active={tab === 'learning'} onClick={() => go(TAB_PATH.learning)} short="Learn" />
            <li className="relative flex items-start justify-center">
              <button
                onClick={() => openCompanion()}
                aria-label="Ask Bermi"
                className="absolute -top-5 grid h-[58px] w-[58px] place-items-center rounded-full bg-primary text-on-primary shadow-[0_8px_24px_color-mix(in_srgb,var(--primary)_45%,transparent)] ring-4 ring-surface transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Sparkles size={24} />
              </button>
            </li>
            <BarItem tab={TABS[2]} active={tab === 'money'} onClick={() => go(TAB_PATH.money)} short="Money" />
            <BarItem tab={TABS[3]} active={tab === 'wellbeing'} onClick={() => go(TAB_PATH.wellbeing)} short="Well-being" />
          </ul>
        </nav>
      </div>

      <Sheet open={account} onClose={() => setAccount(false)} title={name || 'Account'}>
        <div className="space-y-1">
          <MenuRow icon={<Settings size={18} />} label="Settings & appearance" onClick={() => { setAccount(false); setSettings(true) }} />
          <MenuRow icon={<MessageSquare size={18} />} label="Full chat" onClick={() => { setAccount(false); go('/chat') }} />
          <MenuRow icon={<GraduationCap size={18} />} label="Learning portal" onClick={() => { setAccount(false); go('/portal') }} />
          {isAdmin && <MenuRow icon={<Shield size={18} />} label="Bermi Control" onClick={() => { setAccount(false); go('/admin') }} />}
          <MenuRow icon={<LogOut size={18} />} label="Sign out" onClick={signOut} />
        </div>
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
  )
}

function RailLink({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`flex min-h-[44px] items-center justify-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 xl:justify-start ${
        active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden truncate xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </button>
  )
}

function BarItem({ tab, active, onClick, short }: { tab: (typeof TABS)[number]; active: boolean; onClick: () => void; short: string }) {
  const Icon = tab.icon
  return (
    <li className="flex">
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        aria-label={tab.label}
        className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 ${active ? 'text-primary' : 'text-ink-muted'}`}
      >
        <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
        <span className="text-[10.5px] font-medium leading-none">{short}</span>
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
