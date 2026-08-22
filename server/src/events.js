// Event registration forms, chat-native multi-turn form collection, approval
// workflow, and ticket issuance — all stored through the generic settings
// key-value store (see storage/sqlite.js + storage/supabase.js) so none of
// this needs a schema migration on either backend.
import { randomBytes } from 'node:crypto'
import { storage } from './storage/index.js'
import { complete } from './openrouter.js'
import { extractJson } from './json-extract.js'

const FORM_KEY = (courseId) => `event-form:${courseId}`
const ANSWERS_KEY = (enrollmentId) => `event-reg-data:${enrollmentId}`
const PENDING_KEY = (conversationId) => `event-reg-pending:${conversationId}`
const TICKET_KEY = (code) => `event-ticket:${code}`
const TICKET_BY_ENROLLMENT_KEY = (enrollmentId) => `event-ticket-for:${enrollmentId}`

const DEFAULT_FORM = { fields: [], requiresApproval: false }
const FIELD_TYPES = new Set(['text', 'email', 'phone', 'number', 'textarea'])

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function sanitizeFields(fields) {
  if (!Array.isArray(fields)) return []
  return fields
    .filter((f) => f && typeof f.label === 'string' && f.label.trim())
    .slice(0, 20)
    .map((f, i) => ({
      id: (typeof f.id === 'string' && f.id.trim()) || `f${i}_${f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`,
      label: f.label.trim().slice(0, 120),
      type: FIELD_TYPES.has(f.type) ? f.type : 'text',
      required: f.required !== false,
    }))
}

export async function getRegistrationForm(courseId) {
  try {
    const raw = await storage.getSetting(FORM_KEY(courseId))
    if (!raw) return DEFAULT_FORM
    const parsed = JSON.parse(raw)
    return { fields: sanitizeFields(parsed.fields), requiresApproval: !!parsed.requiresApproval }
  } catch {
    return DEFAULT_FORM
  }
}

export async function setRegistrationForm(courseId, form) {
  const clean = { fields: sanitizeFields(form?.fields), requiresApproval: !!form?.requiresApproval }
  await storage.setSetting(FORM_KEY(courseId), JSON.stringify(clean))
  return clean
}

export async function getRegistrationAnswers(enrollmentId) {
  try {
    const raw = await storage.getSetting(ANSWERS_KEY(enrollmentId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function saveRegistrationAnswers(enrollmentId, answers) {
  await storage.setSetting(ANSWERS_KEY(enrollmentId), JSON.stringify(answers || {}))
}

function missingRequiredFields(fields, answers) {
  return fields.filter((f) => f.required && !String(answers[f.id] ?? '').trim())
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

// Open-weight models don't reliably return clean JSON for freeform text —
// see the identical rationale in json-extract.js. This asks the model to
// pull whatever field values it can find out of the user's latest chat
// message, merging on top of whatever was already collected earlier in the
// conversation so a multi-turn back-and-forth accumulates instead of
// resetting every reply.
export async function extractFormAnswers(message, fields, existingAnswers = {}) {
  const shape = fields.map((f) => `"${f.id}": <${f.label}${f.required ? ', required' : ', optional'}>`).join(',\n  ')
  const raw = await complete({
    model: 'bermi-fast',
    maxTokens: 600,
    messages: [
      {
        role: 'system',
        content:
          'Extract event-registration field values from the user\'s message. Output ONLY a JSON object shaped like:\n' +
          `{\n  ${shape}\n}\n` +
          'Use an empty string "" for any field not present in the message. Do not guess or invent values. Output ONLY the JSON object.',
      },
      { role: 'user', content: message.slice(0, 2000) },
    ],
  })
  let extracted = {}
  try {
    extracted = extractJson(raw)
  } catch {
    extracted = {}
  }
  const merged = { ...existingAnswers }
  for (const f of fields) {
    const v = extracted[f.id]
    if (typeof v === 'string' && v.trim()) merged[f.id] = v.trim()
  }
  return merged
}

export async function startRegistration(conversationId, courseId) {
  await storage.setSetting(PENDING_KEY(conversationId), JSON.stringify({ courseId, answers: {} }))
}

export async function getPendingRegistration(conversationId) {
  try {
    const raw = await storage.getSetting(PENDING_KEY(conversationId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function clearPendingRegistration(conversationId) {
  await storage.setSetting(PENDING_KEY(conversationId), '')
}

/**
 * Advances a pending chat-native registration by one turn: merges any newly
 * extracted field values from `message`, and either finalizes the
 * registration (enrollment created, answers saved, ticket issued unless the
 * event requires approval) once every required field is filled, or reports
 * what's still missing so the caller can ask for just that.
 */
export async function continueRegistration({ conversationId, message, user, createEnrollment, getInstitution }) {
  const pending = await getPendingRegistration(conversationId)
  if (!pending?.courseId) return null
  const course = await storage.getCourse(pending.courseId)
  if (!course) {
    await clearPendingRegistration(conversationId)
    return { done: false, error: true, courseGone: true }
  }
  const form = await getRegistrationForm(course.id)
  const answers = await extractFormAnswers(message, form.fields, pending.answers || {})
  const missing = missingRequiredFields(form.fields, answers)
  if (missing.length) {
    await storage.setSetting(PENDING_KEY(conversationId), JSON.stringify({ courseId: course.id, answers }))
    return { done: false, course, missing, answers }
  }
  const existing = await storage.getEnrollment(course.id, user.id)
  const newStatus = form.requiresApproval || course.enrollment === 'approval' ? 'applied' : 'enrolled'
  let enrollment
  if (existing && existing.status === 'rejected') {
    // A previously rejected application shouldn't permanently block a retry —
    // the (course_id, user_id) row already exists, so re-open it in place
    // rather than trying to insert a duplicate.
    enrollment = await storage.updateEnrollment(existing.id, { status: newStatus })
  } else if (existing) {
    enrollment = existing
  } else {
    enrollment = await createEnrollment({ courseId: course.id, userId: user.id, status: newStatus })
  }
  await saveRegistrationAnswers(enrollment.id, answers)
  await clearPendingRegistration(conversationId)
  let ticket = null
  if (enrollment.status === 'enrolled') {
    const institution = getInstitution ? await getInstitution(course.institution_id) : null
    ticket = await issueTicket({ course, institution, user, enrollment })
  }
  return { done: true, course, enrollment, answers, ticket, needsApproval: enrollment.status === 'applied' }
}

// ---- Owner-side management ----

export async function listRegistrations(courseId) {
  const enrollments = await storage.listEnrollmentsByCourse(courseId)
  const out = []
  for (const e of enrollments) {
    const [learner, answers, ticket_code] = await Promise.all([
      storage.getUserById(e.user_id),
      getRegistrationAnswers(e.id),
      e.status === 'enrolled' ? getTicketCodeForEnrollment(e.id) : null,
    ])
    out.push({
      enrollment_id: e.id,
      user_id: e.user_id,
      name: learner?.name || 'Guest',
      email: learner?.email || '',
      status: e.status,
      ticket_code,
      registered_at: e.enrolled_at,
      answers,
    })
  }
  return out
}

export async function approveRegistration({ enrollment, course, institution, user }) {
  const updated = await storage.updateEnrollment(enrollment.id, { status: 'enrolled' })
  const ticket = await issueTicket({ course, institution, user, enrollment: updated })
  return { enrollment: updated, ticket }
}

export async function rejectRegistration(enrollment) {
  return storage.updateEnrollment(enrollment.id, { status: 'rejected' })
}
