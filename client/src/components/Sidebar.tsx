import { useMemo, useState } from 'react'
import { MessageSquare, Plus, Search, Settings, Trash2, X } from 'lucide-react'
import type { Conversation } from '../lib/types'

interface SidebarProps {
  open: boolean
  onClose: () => void
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
}

function groupLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'Previous 7 days'
  if (diffDays < 30) return 'Previous 30 days'
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenSettings,
}: SidebarProps) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const filtered = query
      ? conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
      : conversations
    const map = new Map<string, Conversation[]>()
    for (const c of filtered) {
      const label = groupLabel(c.updated_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(c)
    }
    return [...map.entries()]
  }, [conversations, query])

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-edge bg-surface-sunken transition-transform duration-200 md:static md:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              B
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Bermi AI</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-2">
          {groups.length === 0 && (
            <p className="px-2 pt-6 text-center text-sm text-ink-faint">
              {query ? 'No conversations match.' : 'No conversations yet.'}
            </p>
          )}
          {groups.map(([label, items]) => (
            <div key={label} className="mb-1">
              <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {label}
              </div>
              {items.map((c) => (
                <div
                  key={c.id}
                  className={`group relative flex items-center rounded-lg ${
                    c.id === activeId
                      ? 'bg-primary-soft text-ink'
                      : 'text-ink-muted hover:bg-surface-raised'
                  }`}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm"
                  >
                    <MessageSquare size={14} className="shrink-0 opacity-60" />
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="absolute right-1.5 hidden rounded p-1 text-ink-faint hover:text-red-500 group-hover:block"
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-edge p-3">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-raised"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              U
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">You</div>
              <div className="truncate text-xs text-ink-faint">Settings & profile</div>
            </div>
            <Settings size={15} className="shrink-0 text-ink-faint" />
          </button>
        </div>
      </aside>
    </>
  )
}
