# LUDIA NAIL

Mobile-first nail salon operating system.

## Product direction
- Main product: a simple, polished replacement for salon booking/CRM tools such as Ahasoft.
- Product shell: Today · Booking · Customers · More.
- Booking keeps the proven salon-scheduler structure, redesigned with an iPhone-like interaction system.
- LUDIA ART STUDIO stays under More as a differentiated add-on.
- Vercel + Supabase + PWA direction.
- Replit is not used.

## Current baseline
**v2.2 — Precision ART Editor + Fresh Batches**

### Reference-led principles
- Apple HIG: deliberate toolbar/tab density, content-first hierarchy, neutral grouped surfaces.
- Fresha: tap an empty time slot to create an appointment.
- GlossGenius: day/week/team filtering and team overview.
- Square Appointments: side-by-side staff schedule.
- Vagaro: fast staff/date switching and dense salon-calendar utility.

### Current highlights
- Finger-level precision editor: select one or more nails and directly change shape, length, color, texture and parts count with instant local rendering.
- Fresh-generation batch flow: `6개 시안 만들기` now starts from the current brief instead of recycling prior generated results.
- Six slots appear immediately, fill progressively, and each run receives a unique batch identity and variation seed.
- Rebuilt Today from dashboard cards into a native mobile agenda: date, next appointment, glance metrics, schedule, alerts.
- Rebuilt More into grouped Settings-style rows.
- Refined Calendar with iOS-like date selection, neutral staff filters and one-accent appointment blocks.
- Reworked customer list and bottom tab bar into the same visual system.
- Restored app.js/styles.css/sw.js after an empty-file regression and bumped service-worker cache to v1.9.
- Preserved v1.8 continuous nail-model ART flow.

Vercel should deploy the `main` branch automatically.


## ART v2.0
The ART editor is now a live model workspace with immediate finger-level changes, original/current comparison, undo/redo, direct Korean edit requests, and network-first core updates.


## ART v2.1
ART generation is now batch-based. Restored history stays in the library, while each create/regenerate action builds six fresh local-render variants from the current concept, DNA, conditions, time/price limits and inventory preference. This is the renderer-independent scaffold for a future production image-generation backend.


## ART v2.2
The live editor now supports finger-level shape, length, color, texture and parts controls. Existing quick edits, natural-language edits, undo/redo, comparison and multi-angle preview remain intact. Legacy saved designs are migrated with safe default shape/length values when opened.
