import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, Share, X } from 'lucide-react'
import { BermiTile } from './Logo'

const DISMISS_KEY = 'bermi-install-dismissed-at'
const DISMISS_DAYS = 14

function recentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const at = Number(raw)
  return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 86_400_000
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's legacy, non-standard flag — still the only signal it exposes.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Chrome/Edge (desktop or Android) fire this once their own installability +
// engagement heuristics are met; capturing it lets us show our own prominent
// banner right when that happens instead of relying on the browser's own
// easy-to-miss address-bar icon or mini-infobar.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * A self-contained, automatic "install Bermi" banner — no menu-hunting
 * required. Android/Chrome gets a real one-tap install; iOS Safari has no
 * install API at all, so it gets clear Share-sheet instructions instead.
 * Silent wherever installing makes no sense: already installed (standalone,
 * or running inside the Capacitor native shell) or recently dismissed.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone() || recentlyDismissed()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // No install-prompt API exists on iOS at all — the closest thing to
    // "automatic" there is showing our own instructions unprompted, once,
    // shortly after the page has had a moment to settle.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    let iosTimer: ReturnType<typeof setTimeout> | undefined
    if (isIOS) {
      iosTimer = setTimeout(() => setPlatform((p) => p ?? 'ios'), 2500)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setPlatform(null)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // Accepted or not, the browser only lets a prompt fire once per capture
    // — treat both outcomes the same way and don't ask again this cycle.
    if (outcome) localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDeferred(null)
    setPlatform(null)
  }

  if (!platform) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="animate-fade-up flex w-full max-w-sm items-center gap-3 rounded-2xl border border-edge bg-surface-raised px-4 py-3.5 shadow-xl">
        <BermiTile size={36} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">Install Bermi AI</p>
          <p className="text-[12px] leading-snug text-ink-muted">
            {platform === 'android'
              ? 'Add it to your home screen for a faster, full-screen experience.'
              : 'Tap Share, then "Add to Home Screen" for a full-screen app.'}
          </p>
        </div>
        {platform === 'android' ? (
          <button
            onClick={install}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-primary-hover"
          >
            <Download size={14} /> Install
          </button>
        ) : (
          <Share size={18} className="shrink-0 text-primary" />
        )}
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
