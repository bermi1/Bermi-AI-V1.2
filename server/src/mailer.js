/**
 * Outbound email for account flows. Transport is chosen from the environment:
 *   - RESEND_API_KEY            → Resend HTTP API
 *   - SMTP_HOST (+USER/PASS)    → any SMTP provider via nodemailer
 *   - EMAIL_MODE=console        → log emails to the server console (dev)
 *   - none of the above         → email disabled; signup auto-verifies
 */

function transport() {
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SMTP_HOST) return 'smtp'
  if (process.env.EMAIL_MODE === 'console') return 'console'
  return 'none'
}

export const emailEnabled = () => transport() !== 'none'

const FROM = () => process.env.EMAIL_FROM || 'Bermi AI <no-reply@bermi.ai>'

export async function sendMail({ to, subject, html, text }) {
  const mode = transport()
  if (mode === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM(), to: [to], subject, html, text }),
    })
    if (!res.ok) throw new Error(`Resend error (${res.status}): ${(await res.text()).slice(0, 200)}`)
    return
  }
  if (mode === 'smtp') {
    const { default: nodemailer } = await import('nodemailer')
    const mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    await mailer.sendMail({ from: FROM(), to, subject, html, text })
    return
  }
  if (mode === 'console') {
    console.log(`\n=== EMAIL (console mode) ===\nTo: ${to}\nSubject: ${subject}\n${text}\n===\n`)
    return
  }
  throw new Error('Email is not configured')
}

/** Branded verification/welcome email with the official Bermi mark. */
export function verificationEmail({ name, code, verifyUrl, baseUrl }) {
  const first = (name || 'there').split(' ')[0]
  const logo = baseUrl
    ? `<img src="${baseUrl}/icon-192.png" width="56" height="56" alt="Bermi AI" style="border-radius:14px;display:block;margin:0 auto 18px;">`
    : `<div style="width:56px;height:56px;border-radius:14px;background:#1B3FD6;color:#ffffff;font-size:30px;font-weight:700;line-height:56px;text-align:center;margin:0 auto 18px;font-family:Georgia,serif;">b</div>`

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f1;">
  <div style="max-width:480px;margin:0 auto;padding:40px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1a;">
    <div style="background:#ffffff;border:1px solid #e6e5df;border-radius:16px;padding:36px 32px;text-align:center;">
      ${logo}
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;font-family:Georgia,'Times New Roman',serif;">Welcome to Bermi AI, ${first}</h1>
      <p style="margin:0 0 26px;font-size:14px;line-height:1.6;color:#5c5b56;">
        Confirm your email to activate your account — your AI workspace with chat,
        documents, and brains is ready.
      </p>
      <div style="display:inline-block;background:#EDEBFB;border-radius:12px;padding:14px 28px;margin-bottom:24px;">
        <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#3B2FBF;font-family:ui-monospace,Menlo,monospace;">${code}</span>
      </div>
      <p style="margin:0 0 26px;font-size:12.5px;color:#8d8c85;">This code expires in 30 minutes.</p>
      ${
        verifyUrl
          ? `<a href="${verifyUrl}" style="display:inline-block;background:#3B2FBF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:12px;">Verify my email</a>`
          : ''
      }
    </div>
    <p style="text-align:center;font-size:11.5px;color:#8d8c85;margin-top:20px;line-height:1.6;">
      You're receiving this because this address was used to create a Bermi AI account.<br>
      If this wasn't you, you can safely ignore this email.
    </p>
  </div>
</body></html>`

  const text =
    `Welcome to Bermi AI, ${first}!\n\n` +
    `Your verification code is: ${code}\n` +
    `It expires in 30 minutes.\n\n` +
    (verifyUrl ? `Or verify with one click: ${verifyUrl}\n\n` : '') +
    `If this wasn't you, ignore this email.`

  return { subject: `${code} is your Bermi AI verification code`, html, text }
}
