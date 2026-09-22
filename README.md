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
**v1.9 — Reference-led Apple-grade Salon OS Shell**

### Reference-led principles
- Apple HIG: deliberate toolbar/tab density, content-first hierarchy, neutral grouped surfaces.
- Fresha: tap an empty time slot to create an appointment.
- GlossGenius: day/week/team filtering and team overview.
- Square Appointments: side-by-side staff schedule.
- Vagaro: fast staff/date switching and dense salon-calendar utility.

### v1.9 highlights
- Rebuilt Today from dashboard cards into a native mobile agenda: date, next appointment, glance metrics, schedule, alerts.
- Rebuilt More into grouped Settings-style rows.
- Refined Calendar with iOS-like date selection, neutral staff filters and one-accent appointment blocks.
- Reworked customer list and bottom tab bar into the same visual system.
- Restored app.js/styles.css/sw.js after an empty-file regression and bumped service-worker cache to v1.9.
- Preserved v1.8 continuous nail-model ART flow.

Vercel should deploy the `main` branch automatically.
