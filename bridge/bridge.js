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
function normalizeDate(raw) {
  if (!raw) return null;
  const nums = raw.match(/\d+/g)?.map(Number) || [];
  if (nums.length < 2) return null;
  const now = new Date();
  const [year, month, day] = nums.length >= 3 ? nums : [now.getFullYear(), nums[0], nums[1]];
  if (!year || !month || !day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function normalizeTime(raw) {
  if (!raw) return null;
  const m = raw.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hour = Number(m[2]);
  if (m[1] === '오후' && hour < 12) hour += 12;
  if (m[1] === '오전' && hour === 12) hour = 0;
  if (hour > 23 || Number(m[3]) > 59) return null;
  return `${String(hour).padStart(2, '0')}:${m[3]}`;
}
function identityText(text) {
  return normalizeText(text)
    .replace(/(?:예약번호|예약 번호)\s*[:#]?\s*[A-Za-z0-9-]+/gi, ' ')
    .replace(/\b(?:확정|신청|대기|취소|완료|노쇼|미방문)\b/g, ' ')
    .replace(/01[016789][- ]?\d{3,4}[- ]?\d{4}/g, ' ')
    .replace(/20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}[.\/-]\d{1,2}/g, ' ')
    .replace(/(?:오전|오후)?\s*\d{1,2}:\d{2}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// Conservative reader: only text already rendered in the authenticated SmartPlace page.
// It never intercepts private APIs, reads passwords, or bypasses authentication.
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
  const rawDate = text.match(/(20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}[.\/-]\d{1,2})/)?.[1] || null;
  const rawTime = text.match(/(?:오전|오후)?\s*\d{1,2}:\d{2}/)?.[0] || null;
  const phone = text.match(/01[016789][- ]?\d{3,4}[- ]?\d{4}/)?.[0]?.replace(/\D/g, '') || null;
  const date = normalizeDate(rawDate);
  const time = normalizeTime(rawTime);
  const status = statusFromText(text);
  const identity = identityText(text);
  // Status/raw text are deliberately excluded from the fallback identity so a confirmed→cancelled
  // booking remains the same booking even when SmartPlace does not render a booking number.
  const stableKey = bookingNo || hash({ date, time, phone, identity }).slice(0, 24);
  return { externalId: stableKey, source: 'NAVER', bookingNo, date, time, phone, status, rawText: text };
}

async function pushEvents(events) {
  if (!SYNC_URL) {
    if (events.length) console.log(`[LUDIA] ${events.length} change(s) detected; LUDIA_SYNC_URL is not configured. Changes stay pending and will retry after setup.`);
    return { uploaded: false, reason: 'sync_url_missing' };
  }
  const headers = { 'content-type': 'application/json' };
  if (SYNC_TOKEN) headers.authorization = `Bearer ${SYNC_TOKEN}`;
  // Empty event batches are intentional heartbeats. The server records last_sync_at without
  // customer data so the salon dashboard can distinguish a healthy idle bridge from a stopped PC.
  const response = await fetch(SYNC_URL, { method: 'POST', headers, body: JSON.stringify({ source: 'NAVER', events }) });
  if (!response.ok) throw new Error(`sync failed: HTTP ${response.status}`);
  const body = await response.json().catch(() => ({ ok: true }));
  return { ...body, uploaded: true, heartbeat: events.length === 0 };
}

async function diffAndSync(rows, state) {
  const next = {};
  const events = [];
  const parsed = rows.map(parseCandidate);
  // SmartPlace can render nested rows containing the same reservation. Keep one stable identity.
  for (const row of parsed) {
    const fingerprint = hash(row);
    const existing = next[row.externalId];
    if (existing && existing.row.rawText.length >= row.rawText.length) continue;
    next[row.externalId] = { fingerprint, row, seenAt: new Date().toISOString() };
  }
  for (const [externalId, item] of Object.entries(next)) {
    const prev = state.bookings[externalId];
    if (!prev) events.push({ type: 'created', booking: item.row });
    else if (prev.fingerprint !== item.fingerprint) events.push({ type: 'updated', booking: item.row });
  }
  // Missing rows are never auto-cancelled: pagination/filter/UI changes can hide valid bookings.
  // Cancellation is emitted only when SmartPlace visibly renders a cancelled status.
  const result = await pushEvents(events);
  // Critical durability rule: never acknowledge detected changes locally until the remote endpoint
  // accepted them. This prevents first-run reservations from disappearing when setup is incomplete,
  // the network is down, or the sync endpoint temporarily fails.
  if (result.uploaded) {
    state.bookings = { ...state.bookings, ...next };
    state.lastSyncAt = new Date().toISOString();
    await writeState(state);
  }
  return { events, uploaded: result.uploaded, pending: events.length && !result.uploaded, heartbeat: result.heartbeat === true };
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
        const result = await diffAndSync(visible, state);
        const syncState = result.pending ? `pending ${result.events.length}` : result.heartbeat ? 'heartbeat ok' : `changes ${result.events.length}`;
        console.log(`[LUDIA] ${new Date().toLocaleTimeString('ko-KR')} · visible ${visible.length} · ${syncState}`);
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
