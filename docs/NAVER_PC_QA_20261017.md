# Naver PC connection QA · 2026-10-17

Implementation: v2.64.0, commit 5363bf7ffe3c8b2ffe2287b32d9d38e202833283.
Production: https://ludianail.vercel.app/
Vercel deployment dpl_BhKGBagUzWb8Ef6ZS1J3EZoDYnQi was READY for this exact implementation.

## Verified

- 57 root regression tests passed, including existing pricing standards and all six golden quotes.
- 3 isolated DOM/form tests passed. These use a synthetic fixture, not SmartPlace account data.
- 64 JavaScript files passed actual Node syntax checks; git diff --check passed.
- Protected loopback setup HTTP flow was exercised with real local HTTP requests: missing capability and other origins denied, secret omitted from responses, masked preview, explicit confirmation, no save after shop change or ambiguous fields, no save to an unready server, and start after reviewed save.
- The authenticated server permission probe used read-only database requests; it did not write a booking, heartbeat, or last Sync.
- Windows ZIP had exactly 19 allowlisted source/config-example files. CRC, CRLF command files, pinned package lock, exclusion of real config/profile/exports/dependencies, and SHA-256 passed.
- Production browser actually opened More → Naver SmartPlace → PC connection start. Current server flags appeared as setup pending, not connected.
- The download button completed a real browser download. Its bytes exactly matched the locally tested ZIP.

ZIP: downloads/ludia-naver-bridge-0.4.0.zip
SHA-256: 6c5ced462f8e669baa5d88ffff1fa11882c3ed048d944353a2f44c3576a79e5e

## Actual Production mobile viewport checks

| Width | Booking Light/Dark | Connection guide Light/Dark |
| --- | --- | --- |
| 360 | 7 days, root scrollWidth 360 | root 360; sheet client/scroll 345 |
| 375 | 7 days, root scrollWidth 375 | root 375; sheet client/scroll 360 |
| 390 | 7 days, root scrollWidth 390 | root 390; sheet client/scroll 375 |
| 412 | 7 days, root scrollWidth 412 | root 412; sheet client/scroll 397 |
| 430 | 7 days, root scrollWidth 430 | root 430; sheet client/scroll 415 |

Both themes were actually toggled in the deployed app. The guide download target was 48px high. Guide screenshots were visually inspected in desktop Light and 390px Dark. The 15px sheet difference is Chrome's vertical scrollbar, not horizontal overflow. Physical iPhone/Safari and Windows PC execution were not tested.

No app-origin console error appeared in the inspected browser error log; the recorded errors came from the browser extension metadata script.

## Real blockers and limits

The Production public sync endpoint reported ready=false, supabaseConfigured=false, salonConfigured=false, and tokenConfigured=false. Vercel environment metadata contained no integration server settings. This is not a request to recreate the existing Vercel/Supabase/GitHub connections: the current server integration configuration is missing.

INBETWEEN reported ACTIVE_HEALTHY, but management SQL requests (including SELECT 1) timed out. Current salon/bookings row counts were not verified. No DB mutation, auth/RLS relaxation, server-key retrieval, or fabricated connected state was performed.

Actual owner login and SmartPlace DOM, current filter/pagination/virtualized-row coverage, registration/time changes/cancellation, real staff/service mappings, reboot/outbox behavior on a shop PC, folder selection, and phone access remain account/device E2E items. The picker makes these reviewable; it does not establish that the real screen has already been verified.

Collection remains Naver → LUDIA, only for rendered rows in the reviewed view. It does not create/cancel a Naver booking or block Naver availability for a LUDIA manual appointment. Attachment photos and reviews are not collected.
