# LUDIA Naver Bridge (local Windows bridge)

This folder is the first runnable scaffold for the C-route SmartPlace integration. It runs on the salon PC and uses a persistent Playwright browser profile. The user signs into Naver **inside Naver's own page**. LUDIA does not ask for, read, transmit, or save the Naver password.

## Run

1. Install Node.js 20+ on the salon Windows PC.
2. In this folder run `npm install` and then `npx playwright install chromium`.
3. Run `npm start`.
4. A dedicated Chromium window opens. Sign in to Naver manually and navigate to the SmartPlace booking list.
5. Keep the window/session available. The bridge checks rendered booking rows every 60 seconds by default.

Optional environment variables:

- `LUDIA_SMARTPLACE_URL`: exact SmartPlace booking-list URL for the salon. Prefer setting this after the owner has navigated to the correct page.
- `LUDIA_POLL_MS`: polling interval, minimum 30000 ms.
- `LUDIA_SYNC_URL`: LUDIA server endpoint that accepts `{ source, events }`. If omitted, the bridge stays in local observation mode and uploads nothing.
- `LUDIA_SYNC_TOKEN`: bearer token for the LUDIA endpoint. Never use a Supabase service-role key in this desktop bridge.
- `LUDIA_NAVER_PROFILE`: local persistent browser-profile path.

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
- No private SmartPlace API interception. The current scaffold reads text already rendered in the authenticated page.
- Session cookies live only in the local Playwright profile directory and must not be committed or uploaded.
- The DOM reader is intentionally conservative. Before production use, capture the exact SmartPlace booking-list DOM from the salon account and replace the broad candidate selector with stable semantic selectors.
- Customer PII should be minimized before sync. Phone numbers are parsed only so the mapping contract is explicit; production should hash/mask them unless the salon workflow genuinely requires the number.

## Next implementation step

Create the LUDIA server ingestion endpoint and Supabase tables (`external_bookings`, `booking_sync_events`, `integration_connections`), then expose connection health in the iOS-style `더보기 > 연결된 서비스 > 네이버 예약` screen. The bridge should send only normalized fields after the SmartPlace DOM is validated against the real salon account.
