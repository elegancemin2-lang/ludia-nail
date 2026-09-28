# LUDIA Naver Bridge (local Windows bridge)

This folder is the runnable C-route SmartPlace integration. It runs on the salon PC and uses a persistent Playwright browser profile. The user signs into Naver **inside Naver's own page**. LUDIA does not ask for, read, transmit, or save the Naver password.

## Run

### Windows recommended
1. Double-click `START_NAVER_BRIDGE.cmd`.
2. On first run it creates `config.local.json` from `config.example.json` and opens it in Notepad.
3. Put the same long `LUDIA_SYNC_TOKEN` used by Vercel into `syncToken`. The production sync URL is already filled in.
4. Run `START_NAVER_BRIDGE.cmd` again.
5. A dedicated Chromium window opens. Sign in to Naver **only inside Naver's page** and navigate to the SmartPlace booking list.
6. Keep the window/session available. The bridge checks rendered booking rows every 60 seconds by default.

The bridge remembers the last SmartPlace page where valid reservations were recognized. Before a real salon login has been validated, it runs in **safe fallback mode**: only rows containing a parseable date, time, and reservation status are uploaded. Set `bookingRowSelector` after the real SmartPlace booking DOM is confirmed to make extraction stricter and more stable.

### Manual / developer run
Install Node.js 20+, then run `npm install`, `npx playwright install chromium`, and `npm start`. Environment variables still override values in `config.local.json`.

For the Vercel deployment in this repository, `LUDIA_SYNC_URL` should point to `https://<production-domain>/api/naver-sync`. Generate a long random `LUDIA_SYNC_TOKEN` and set the **same value** in the salon PC environment and Vercel environment. Never put the Supabase secret/service-role key on the salon PC.

Optional environment variables:

- `LUDIA_SMARTPLACE_URL`: exact SmartPlace booking-list URL for the salon. Prefer setting this after the owner has navigated to the correct page.
- `LUDIA_POLL_MS`: polling interval, minimum 30000 ms.
- `LUDIA_SYNC_URL`: LUDIA server endpoint that accepts `{ source, events }`.
- `LUDIA_SYNC_TOKEN`: bearer token for the LUDIA endpoint.
- `LUDIA_NAVER_PROFILE`: local persistent browser-profile path.
- `LUDIA_BOOKING_ROW_SELECTOR`: optional exact CSS selector for one SmartPlace reservation row. Until the live account DOM is validated, leave it blank and use safe fallback mode.
- `LUDIA_BRIDGE_CONFIG`: optional path to a local JSON config file.

## Server + Supabase setup

The repository now contains `api/naver-sync.js` and `supabase/naver_bridge.sql`; both use the shared INBETWEEN Supabase project's isolated `ludia_*` namespace.

1. Run `supabase/naver_bridge.sql` once in the target Supabase project.
2. Configure Vercel server-side environment variables: `LUDIA_SYNC_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (preferred), and `LUDIA_SALON_ID`. Legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported as a fallback.
3. Redeploy the production project.
4. Open `/api/naver-sync` with GET to check endpoint health. It reports whether Supabase is configured, but never returns secrets.
5. Start the local bridge with the matching sync URL/token.

`SUPABASE_SECRET_KEY` belongs **only** in Vercel/server environment variables. Do not place it in `app.js`, localStorage, the browser, the Playwright profile, or bridge environment. Legacy `SUPABASE_SERVICE_ROLE_KEY` follows the same rule.

## Event contract

```json
{
  "source": "NAVER",
  "events": [
    {
      "type": "created | updated",
      "booking": {
        "externalId": "stable external key",
        "source": "NAVER",
        "bookingNo": null,
        "date": "2026-09-23",
        "time": "13:00",
        "phone": null,
        "status": "confirmed | requested | cancelled | completed | no_show | unknown",
        "rawText": "rendered row text"
      }
    }
  ]
}
```

The bridge deliberately does **not** treat a missing row as a cancellation because pagination or a SmartPlace filter can make an existing reservation disappear from the current DOM. Cancellation is emitted only when the rendered row itself exposes the changed status.

## Safety / reliability rules

- No CAPTCHA bypass, 2FA bypass, password capture, or credential storage.
- No private SmartPlace API interception. The current reader inspects text already rendered in the authenticated page.
- Session cookies live only in the local Playwright profile directory and must not be committed or uploaded.
- The DOM reader is intentionally conservative. Before production use, validate the exact SmartPlace booking-list DOM from the salon account and set a stable `bookingRowSelector`. Safe fallback mode refuses rows that do not have a parseable date, time, and recognizable reservation status.
- Customer PII should be minimized. The server endpoint accepts only normalized booking fields, caps payload size, requires a bearer token, and keeps the Supabase secret key server-side.

## Next implementation step

Validate the real salon SmartPlace booking-list DOM and extract customer/service/staff fields with stable semantic selectors. Only after that validation should the bridge promote staged `external_bookings` into the main `appointments` calendar; do not invent missing customer/service data.
