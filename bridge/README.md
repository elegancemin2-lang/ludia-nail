# LUDIA Naver Bridge (local Windows bridge)

This folder is the runnable C-route SmartPlace integration. It runs on the salon PC and uses a persistent Playwright browser profile. The user signs into Naver **inside Naver's own page**. LUDIA does not ask for, read, transmit, or save the Naver password.

## Run

1. Install Node.js 20+ on the salon Windows PC.
2. In this folder run `npm install` and then `npx playwright install chromium`.
3. Configure `LUDIA_SMARTPLACE_URL`, `LUDIA_SYNC_URL`, and `LUDIA_SYNC_TOKEN` as environment variables.
4. Run `npm start`.
5. A dedicated Chromium window opens. Sign in to Naver manually and navigate to the SmartPlace booking list.
6. Keep the window/session available. The bridge checks rendered booking rows every 60 seconds by default.

For the Vercel deployment in this repository, `LUDIA_SYNC_URL` should point to `https://<production-domain>/api/naver-sync`. Generate a long random `LUDIA_SYNC_TOKEN` and set the **same value** in the salon PC environment and Vercel environment. Never put the Supabase secret/service-role key on the salon PC.

Optional environment variables:

- `LUDIA_SMARTPLACE_URL`: exact SmartPlace booking-list URL for the salon. Prefer setting this after the owner has navigated to the correct page.
- `LUDIA_POLL_MS`: polling interval, minimum 30000 ms.
- `LUDIA_SYNC_URL`: LUDIA server endpoint that accepts `{ source, events }`.
- `LUDIA_SYNC_TOKEN`: bearer token for the LUDIA endpoint.
- `LUDIA_NAVER_PROFILE`: local persistent browser-profile path.

## Server + Supabase setup

The repository now contains `api/naver-sync.js` and `supabase/naver_bridge.sql`.

1. Run `supabase/naver_bridge.sql` once in the target Supabase project.
2. Configure Vercel server-side environment variables: `LUDIA_SYNC_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (preferred). Legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported as a fallback.
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
- The DOM reader is intentionally conservative. Before production use, validate the exact SmartPlace booking-list DOM from the salon account and replace the broad candidate selector with stable semantic selectors.
- Customer PII should be minimized. The server endpoint accepts only normalized booking fields, caps payload size, requires a bearer token, and keeps the Supabase secret key server-side.

## Next implementation step

Validate the real salon SmartPlace booking-list DOM and extract customer/service/staff fields with stable semantic selectors. Only after that validation should the bridge promote staged `external_bookings` into the main `appointments` calendar; do not invent missing customer/service data.
