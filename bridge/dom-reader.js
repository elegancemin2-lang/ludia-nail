// Shared by the setup preview and live bridge. Values come only from owner-selected fields.
export function extractRenderedRows({selector, fields}) {
  const visible = el => Boolean(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const elements = [...document.querySelectorAll(selector)].filter(visible);
  if (elements.length > 1000) throw Error('booking_row_limit');
  return elements.map(el => {
    const out = {}, errors = [];
    for (const [key, fieldSelector] of Object.entries(fields)) {
      if (!fieldSelector) continue;
      const nodes = (fieldSelector === ':scope' ? [el] : [...el.querySelectorAll(fieldSelector)]).filter(visible);
      if (nodes.length !== 1) errors.push(key);
      else out[key] = clean(nodes[0].textContent);
    }
    return {text: clean(el.textContent).slice(0, 2000), fields: out, errors};
  });
}

export async function readRenderedRows(page, config) {
  return page.locator('body').evaluate(extractRenderedRows, {selector: config.bookingRowSelector, fields: config.bookingFields});
}

export function maskedPreview(rows) {
  return rows.slice(0, 8).map(row => ({
    bookingNo: '…' + row.bookingNo.slice(-4), date: row.date, time: row.time, status: row.status,
    customer: row.customerName ? row.customerName.slice(0, 1) + '○'.repeat(Math.min(3, row.customerName.length - 1)) : '미확인',
    staff: row.staffName || '미지정', service: row.serviceName || '미확인', duration: row.duration || null
  }));
}
