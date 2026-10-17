import {createHash} from 'node:crypto';

export const REQUIRED_FIELDS = ['bookingNo', 'status'];
export const FIELD_KEYS = ['bookingNo', 'date', 'time', 'dateTime', 'status', 'phone', 'customerName', 'serviceName', 'staffName', 'duration'];
export const DEFAULT_SYNC_URL = 'https://ludianail.vercel.app/api/naver-sync';
const fail = code => { throw new Error(code); };

export function smartplaceUrl(value) {
  let url; try { url = new URL(value); } catch { return fail('smartplace_url_required'); }
  if (url.protocol !== 'https:' || !/(^|\.)smartplace\.naver\.com$/.test(url.hostname) || url.username || url.password || url.port) fail('official_smartplace_url_required');
  return url.href;
}

export function syncUrl(value) {
  let url; try { url = new URL(value); } catch { return fail('sync_url_required'); }
  if (url.protocol !== 'https:' || url.origin !== 'https://ludianail.vercel.app' || url.pathname !== '/api/naver-sync' || url.search || url.hash || url.username || url.password) fail('official_ludia_endpoint_required');
  return url.href;
}

// Fixed URL parameters can identify a different shop. Never ignore them, or the hash.
// A date/range change deliberately requires checking that view again.
export function pageMatches(current, configured) {
  try {
    const a = new URL(smartplaceUrl(current)), b = new URL(smartplaceUrl(configured));
    return a.origin === b.origin && a.pathname === b.pathname && a.hash === b.hash && a.searchParams.size === b.searchParams.size &&
      [...b.searchParams].every(([key, value]) => a.searchParams.getAll(key).length === b.searchParams.getAll(key).length && a.searchParams.getAll(key).includes(value));
  } catch { return false; }
}

export function cleanSelectors(config) {
  const fields = {};
  for (const key of FIELD_KEYS) {
    const value = String(config.bookingFields?.[key] || '').trim();
    if (value.length > 500) fail('selector_too_long');
    fields[key] = value;
  }
  const row = String(config.bookingRowSelector || '').trim();
  if (row.length > 500) fail('selector_too_long');
  return {bookingRowSelector: row, bookingFields: fields};
}

export function selectorFingerprint(config) {
  return createHash('sha256').update(JSON.stringify({smartplaceUrl: config.smartplaceUrl || '', ...cleanSelectors(config)})).digest('hex');
}

export function selectorsReady(config) {
  try {
    const {bookingRowSelector, bookingFields: f} = cleanSelectors(config);
    return config.selectorsVerified === true && Boolean(bookingRowSelector) && REQUIRED_FIELDS.every(k => f[k]) &&
      Boolean(f.dateTime || (f.date && f.time)) &&
      (!config.selectorVerification?.fingerprint || config.selectorVerification.fingerprint === selectorFingerprint(config));
  } catch { return false; }
}

export function validateConfig(config) {
  if (!['local', 'server'].includes(config.deliveryMode || 'server')) fail('invalid_delivery_mode');
  smartplaceUrl(config.smartplaceUrl);
  if (config.deliveryMode !== 'local') {
    syncUrl(config.syncUrl);
    if (typeof config.syncToken !== 'string' || config.syncToken.trim().length < 32 || config.syncToken.length > 1024 || /^PASTE_/i.test(config.syncToken)) fail('sync_key_required');
  }
  cleanSelectors(config);
  if (!selectorsReady(config)) fail('booking_screen_not_verified');
  return config;
}

// The request body supplies only editable, non-path settings. Never allow arbitrary file writes.
export function editableConfig(previous, input) {
  const mode = input.deliveryMode || previous.deliveryMode || 'local';
  const next = {...previous, ...cleanSelectors(input), deliveryMode: mode, smartplaceUrl: smartplaceUrl(input.smartplaceUrl),
    syncUrl: syncUrl(input.syncUrl || previous.syncUrl || DEFAULT_SYNC_URL), pollMs: 60000, selectorsVerified: false};
  if (!['local', 'server'].includes(mode)) fail('invalid_delivery_mode');
  if (input.syncToken) next.syncToken = String(input.syncToken).trim();
  if (mode !== previous.deliveryMode) next.stateFile = mode === 'local' ? './.bridge-local-state.json' : './.bridge-state.json';
  return next;
}

export function publicConfig(config) {
  return {...cleanSelectors(config), deliveryMode: config.deliveryMode || 'local', smartplaceUrl: config.smartplaceUrl || '',
    syncUrl: config.syncUrl || DEFAULT_SYNC_URL, hasSyncKey: Boolean(config.syncToken?.length >= 32 && !/^PASTE_/i.test(config.syncToken)),
    verified: selectorsReady(config)};
}
