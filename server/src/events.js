// Event tickets — an AI-processed, organization-branded ticket issued the
// moment someone registers for an event through chat. Deliberately minimal:
// no organizer-configured form, no approval queue, no management dashboard —
// registering for an event works exactly like enrolling in anything else
// (see the ENROLL_RE branch in chat.js), it just also produces a ticket.
// Stored through the generic settings key-value store (see storage/sqlite.js
// + storage/supabase.js) so this needs no schema migration on either backend.
import { randomBytes } from 'node:crypto'
import { storage } from './storage/index.js'

const TICKET_KEY = (code) => `event-ticket:${code}`
const TICKET_BY_ENROLLMENT_KEY = (enrollmentId) => `event-ticket-for:${enrollmentId}`

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function generateTicketCode() {
  return `TKT-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function issueTicket({ course, institution, user, enrollment }) {
  const code = generateTicketCode()
  const ticket = {
    code,
    course_id: course.id,
    enrollment_id: enrollment.id,
    user_id: user.id,
    attendee_name: user.name || 'Guest',
    event_title: course.title,
    event_at: course.event_at || null,
    event_location: course.event_location || '',
    institution_name: institution?.name || '',
    institution_logo_url: institution?.logo_url || '',
    issued_at: new Date().toISOString(),
  }
  await storage.setSetting(TICKET_KEY(code), JSON.stringify(ticket))
  await storage.setSetting(TICKET_BY_ENROLLMENT_KEY(enrollment.id), code)
  return ticket
}

export async function getTicket(code) {
  try {
    const raw = await storage.getSetting(TICKET_KEY(code))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function getTicketCodeForEnrollment(enrollmentId) {
  try {
    return (await storage.getSetting(TICKET_BY_ENROLLMENT_KEY(enrollmentId))) || null
  } catch {
    return null
  }
}

export function renderTicketHtml(ticket) {
  const when = ticket.event_at
    ? new Date(ticket.event_at).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Date to be confirmed'
  const logo = ticket.institution_logo_url
    ? `<img src="${escapeHtml(ticket.institution_logo_url)}" alt="" style="height:56px;max-width:220px;object-fit:contain" />`
    : `<div style="font-size:20px;font-weight:700;color:#1B3FD6">${escapeHtml(ticket.institution_name || 'Bermi')}</div>`
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f4f5f8; }
  .ticket { max-width: 720px; margin: 40px auto; border-radius: 24px; overflow: hidden; border: 2px solid #1B3FD622; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 28px 36px; background: linear-gradient(135deg, #1B3FD612, transparent); border-bottom: 1px dashed #d0d3dc; }
  .kicker { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #1B3FD6; }
  .body { padding: 32px 36px; }
  h1 { font-size: 24px; margin: 6px 0 18px; color: #14181f; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eceef2; font-size: 14px; color: #444; }
  .row b { color: #14181f; }
  .footer { display: flex; justify-content: space-between; align-items: center; padding: 20px 36px; background: #fafbfc; font-size: 11.5px; color: #8a8f9c; }
  .code { font-weight: 700; letter-spacing: .05em; color: #1B3FD6; }
</style></head>
<body>
  <div class="ticket">
    <div class="head">
      ${logo}
      <div class="kicker">Event Ticket</div>
    </div>
    <div class="body">
      <div class="kicker" style="margin-bottom:6px">${escapeHtml(ticket.institution_name || '')}</div>
      <h1>${escapeHtml(ticket.event_title)}</h1>
      <div class="row"><span>Attendee</span><b>${escapeHtml(ticket.attendee_name)}</b></div>
      <div class="row"><span>When</span><b>${escapeHtml(when)}</b></div>
      <div class="row"><span>Where</span><b>${escapeHtml(ticket.event_location || 'To be confirmed')}</b></div>
    </div>
    <div class="footer">
      <span>Verification code: <span class="code">${escapeHtml(ticket.code)}</span></span>
      <span>Issued ${escapeHtml(new Date(ticket.issued_at).toLocaleDateString())} via Bermi AI</span>
    </div>
  </div>
</body></html>`
}
