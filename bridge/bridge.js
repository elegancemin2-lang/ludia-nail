import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PROFILE_DIR = path.resolve(process.env.LUDIA_NAVER_PROFILE || './.naver-profile');
const STATE_FILE = path.resolve(process.env.LUDIA_BRIDGE_STATE || './.bridge-state.json');
const SMARTPLACE_URL = process.env.LUDIA_SMARTPLACE_URL || 'https://new.smartplace.naver.com/';
const SYNC_URL = process.env.LUDIA_SYNC_URL || '';
const SYNC_TOKEN = process.env.LUDIA_SYNC_TOKEN || '';
const POLL_MS = Math.max(30000, Number(process.env.LUDIA_POLL_MS || 60000));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function readState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch { return { bookings: {}, lastSyncAt: null }; }
}
async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function normalizeText(v = '') { return v.replace(/\s+/g, ' ').trim(); }
function statusFromText(text) {
  if (/취소/.test(text)) return 'cancelled';
  if (/완료/.test(text)) return 'completed';
  if (/노쇼|미방문/.test(text)) return 'no_show';
  if (/신청|대기/.test(text)) return 'requested';
  if (/확정/.test(text)) return 'confirmed';
  return 'unknown';
}

// Intentionally conservative: this reader only inspects text already rendered in the
// authenticated SmartPlace page. It does not intercept private APIs or bypass auth.
async function extractVisibleBookings(page) {
  return page.locator('body').evaluate(() => {
    const clean = v => (v || '').replace(/\s+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('article, li, tr, [role="row"]')]
      .map((el, index) => ({ index, text: clean(el.innerText) }))
      .filter(x => x.text.length >= 12 && /(예약|확정|신청|취소|완료|노쇼)/.test(x.text));
    return candidates.slice(0, 300);
  });
}

function parseCandidate(row) {
  const text = normalizeText(row.text);
  const bookingNo = text.match(/(?:예약번호|예약 번호)\s*[:#]?\s*([A-Za-z0-9-]+)/i)?.[1] || null;
  const date = text.match(/(20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}[.\/-]\d{1,2})/)?.[1] || null;
  const time = text.match(/(?:오전|오후)?\s*(\d{1,2}:\d{2})/)?.[0]?.trim() || null;
  const phone = text.match(/01[016789][- ]?\d{3,4}[- ]?\d{4}/)?.[0] || null;
  const status = statusFromText(text);
  const stableKey = bookingNo || hash({ date, time, phone, text: text.slice(0, 160) }).slice(0, 24);
  return { externalId: stableKey, source: 'NAVER', bookingNo, date, time, phone, status, rawText: text };
}

async function pushEvents(events) {
  if (!SYNC_URL) {
    if (events.length) console.log(`[LUDIA] ${events.length} change(s) detected; LUDIA_SYNC_URL is not configured, so nothing was uploaded.`);
    return { uploaded: false };
  }
  const headers = { 'content-type': 'application/json' };
  if (SYNC_TOKEN) headers.authorization = `Bearer ${SYNC_TOKEN}`;
  const response = await fetch(SYNC_URL, { method: 'POST', headers, body: JSON.stringify({ source: 'NAVER', events }) });
  if (!response.ok) throw new Error(`sync failed: HTTP ${response.status}`);
  return response.json().catch(() => ({ ok: true }));
}

async function diffAndSync(rows, state) {
  const next = {};
  const events = [];
  for (const row of rows.map(parseCandidate)) {
    const fingerprint = hash(row);
    next[row.externalId] = { fingerprint, row, seenAt: new Date().toISOString() };
    const prev = state.bookings[row.externalId];
    if (!prev) events.push({ type: 'created', booking: row });
    else if (prev.fingerprint !== fingerprint) events.push({ type: 'updated', booking: row });
  }
  // Empty event arrays are intentionally posted as a heartbeat. This lets LUDIA distinguish
  // "no booking changes" from "the shop PC bridge is offline" without exposing credentials.
  await pushEvents(events);
  state.bookings = { ...state.bookings, ...next };
  state.lastSyncAt = new Date().toISOString();
  await writeState(state);
  return events;
}

async function main() {
  console.log('[LUDIA] Naver Bridge starting. Login credentials are never read or stored by this program.');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR'
  });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(SMARTPLACE_URL, { waitUntil: 'domcontentloaded' });
  console.log('[LUDIA] If Naver asks you to sign in or verify, complete it yourself in this browser window. CAPTCHA/2FA is never bypassed.');

  const state = await readState();
  while (true) {
    try {
      const url = page.url();
      if (/nid\.naver\.com|login/i.test(url)) {
        console.log('[LUDIA] Waiting for manual Naver login…');
      } else {
        const visible = await extractVisibleBookings(page);
        const events = await diffAndSync(visible, state);
        console.log(`[LUDIA] ${new Date().toLocaleTimeString('ko-KR')} · visible ${visible.length} · changes ${events.length} · heartbeat sent`);
      }
    } catch (error) {
      console.error('[LUDIA] sync cycle failed:', error.message);
    }
    await sleep(POLL_MS);
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}
  }
}

main().catch(error => {
  console.error('[LUDIA] fatal:', error);
  process.exitCode = 1;
});
