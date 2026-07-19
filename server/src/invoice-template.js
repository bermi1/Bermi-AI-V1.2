function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n, currency) {
  const num = Number(n) || 0
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
  } catch {
    return `${currency} ${num.toFixed(2)}`
  }
}

export function invoiceTotals(data) {
  const subtotal = (data.items || []).reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  )
  const tax = subtotal * ((Number(data.tax_rate) || 0) / 100)
  return { subtotal, tax, total: subtotal + tax }
}

/**
 * Renders an invoice as a self-contained styled HTML document, used both for
 * the in-app preview and as the puppeteer input for PDF export.
 */
export function renderInvoiceHtml(data) {
  const { subtotal, tax, total } = invoiceTotals(data)
  const currency = data.currency || 'USD'
  const rows = (data.items || [])
    .map(
      (it) => `
        <tr>
          <td>${esc(it.description)}</td>
          <td class="num">${esc(it.quantity)}</td>
          <td class="num">${money(it.unit_price, currency)}</td>
          <td class="num">${money((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), currency)}</td>
        </tr>`,
    )
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #1c1c1a;
    background: #fff;
    padding: 48px 56px;
    font-size: 14px;
    line-height: 1.6;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 26px; font-weight: 700; color: #3b2fbf; letter-spacing: -0.02em; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8d8c85; margin-bottom: 4px; }
  .invoice-no { font-size: 18px; font-weight: 600; text-align: right; }
  .meta { text-align: right; color: #5c5b56; font-size: 13px; }
  .parties { display: flex; gap: 48px; margin-bottom: 36px; }
  .party { flex: 1; }
  .party .name { font-weight: 600; margin-bottom: 2px; }
  .party .details { color: #5c5b56; white-space: pre-line; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8d8c85; padding: 10px 12px; border-bottom: 2px solid #3b2fbf; }
  td { padding: 12px; border-bottom: 1px solid #e6e5df; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  th.num, th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 12px; }
  .totals .grand { border-top: 2px solid #3b2fbf; margin-top: 6px; padding-top: 12px; font-size: 17px; font-weight: 700; color: #3b2fbf; }
  .section { margin-top: 32px; }
  .section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #8d8c85; margin-bottom: 6px; }
  .section p { color: #3d3c38; white-space: pre-line; font-size: 13px; }
  .foot { margin-top: 56px; padding-top: 16px; border-top: 1px solid #e6e5df; color: #8d8c85; font-size: 12px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">${esc(data.from_name || 'Invoice')}</div>
      <div class="party details" style="color:#5c5b56; white-space: pre-line; font-size: 13px;">${esc(data.from_details)}</div>
    </div>
    <div>
      <div class="label">Invoice</div>
      <div class="invoice-no">${esc(data.invoice_number)}</div>
      <div class="meta">Issued ${esc(data.issue_date)}<br>Due ${esc(data.due_date)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="label">Billed to</div>
      <div class="name">${esc(data.client_name)}</div>
      <div class="details">${esc(data.client_details)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(subtotal, currency)}</span></div>
    <div class="row"><span>Tax (${esc(data.tax_rate || 0)}%)</span><span>${money(tax, currency)}</span></div>
    <div class="row grand"><span>Total due</span><span>${money(total, currency)}</span></div>
  </div>

  ${data.terms ? `<div class="section"><h3>Payment terms</h3><p>${esc(data.terms)}</p></div>` : ''}
  ${data.notes ? `<div class="section"><h3>Notes</h3><p>${esc(data.notes)}</p></div>` : ''}

  <div class="foot">
    <span>${esc(data.from_name)}</span>
    <span>Generated with Bermi AI</span>
  </div>
</body>
</html>`
}
