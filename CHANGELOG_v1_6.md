# LUDIA NAIL v1.6 — Native Salon Home + True Instant Nail Renderer

## Main product hierarchy
- Salon OS remains the main product: Today / Booking / Customers / More.
- LUDIA ART STUDIO remains under More > Add-on.

## Home interface
- Rebuilt the mobile Today screen around a native mobile agenda pattern instead of a generic dashboard.
- Large date/title, single next-appointment card, compact horizontal summary, grouped schedule, and grouped alerts.
- Removed decorative dashboard copy and unnecessary quick-action card clutter from the first screen.
- Replaced text-symbol bottom navigation with simple line SVG icons.

## ART STUDIO live editing
- Replaced subtle whole-photo CSS filters with a layered nail renderer.
- Each finger has independent base color, photo texture, color wash, magnet light, aurora layer, french layer, and gem/parts layer.
- Selecting a finger and tapping a quick-modification chip updates that finger immediately.
- Repeated taps on light/deep/magnet/aurora/accent/glam step through 3 intensity levels.
- Added a large LIVE preview above the 10-finger selector.
- Added per-selection Reset to original.
- Direct text requests with common style terms map to visible edits when applied.
- Time/price recalculation remains connected to edit state.
- Final multi-angle viewer uses the same layered render state.

## Update / cache
- Service-worker cache bumped to v1.6 to reduce stale assets after Git/Vercel deployment.

## QA
- JavaScript syntax check passed.
- Duplicate HTML ID check passed.
- Mobile interaction QA passed in Chromium using an inlined test harness.
