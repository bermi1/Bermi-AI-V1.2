import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, Download, MapPin, Ticket as TicketIcon } from 'lucide-react'
import * as api from '../lib/api'
import type { Ticket } from '../lib/types'
import { Btn, ErrorNote, Spinner, type LearnRoute } from './ui'
import { BermiMark } from '../components/Logo'

export function TicketView({ code, navigate }: { code: string; navigate: (r: LearnRoute) => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTicket(null)
    setError(null)
    api.learnTicket(code).then(setTicket).catch((e) => setError((e as Error).message))
  }, [code])

  if (error) return <div className="mx-auto max-w-2xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!ticket) return <Spinner label="Loading ticket…" />

  const when = ticket.event_at
    ? new Date(ticket.event_at).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Date to be confirmed'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'mylearning' })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> My learning
      </button>

      <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-surface-raised shadow-lg">
        <div className="border-b border-edge bg-gradient-to-br from-primary/8 to-transparent px-8 py-10 text-center">
          {ticket.institution_logo_url ? (
            <img
              src={ticket.institution_logo_url}
              alt={ticket.institution_name}
              className="mx-auto mb-4 h-14 max-w-[220px] object-contain"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
              <TicketIcon size={26} />
            </div>
          )}
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">Event Ticket</p>
          {ticket.institution_name && <p className="mt-2 text-[13px] text-ink-muted">{ticket.institution_name}</p>}
          <h1 className="mt-3 text-[24px] font-bold text-ink">{ticket.event_title}</h1>
          <p className="mt-4 text-[13px] text-ink-muted">Attendee</p>
          <h2 className="mt-1 text-[18px] font-semibold text-ink">{ticket.attendee_name}</h2>
        </div>
        <div className="space-y-2 px-8 py-5 text-[14px]">
          <div className="flex items-center justify-between border-b border-edge py-2">
            <span className="text-ink-muted">When</span>
            <span className="font-medium text-ink">{when}</span>
          </div>
          {ticket.event_location && (
            <div className="flex items-center justify-between py-2">
              <span className="inline-flex items-center gap-1.5 text-ink-muted"><MapPin size={14} /> Where</span>
              <span className="font-medium text-ink">{ticket.event_location}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 text-[12px] text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck size={14} className="text-emerald-500" /> Verification code: <strong className="text-ink-muted">{ticket.code}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BermiMark size={13} className="text-primary" /> Issued {new Date(ticket.issued_at).toLocaleDateString()} via Bermi AI
          </span>
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <a href={api.learnTicketPdfUrl(ticket.code)} target="_blank" rel="noreferrer">
          <Btn><Download size={16} /> Download ticket</Btn>
        </a>
      </div>
    </div>
  )
}
