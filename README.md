# LUDIA NAIL

Mobile-first nail salon operating system.

## Product direction
- Main product: a simple, polished replacement for salon booking/CRM tools such as Ahasoft.
- Primary navigation: Today · Booking · Customers · More.
- Booking keeps the proven salon-scheduler structure, redesigned with an iPhone-like interaction system.
- LUDIA ART STUDIO is an optional add-on under More.
- Vercel + Supabase + PWA direction.
- Replit is not used.

## Current baseline
**v1.8 — Continuous Nail Model Renderer**

### Current highlights
- Six ART concepts render on a shared procedural nail model instead of rotating fixed JPG samples.
- Each concept has base color, accent, magnet, aurora, french, gems, texture and accent-finger state.
- The same model data persists from concept generation through finger editing, library reuse and multi-angle final preview.
- Repeated magnet / aurora / accent edits have visible 3-step intensity.
- Staff-by-time daily schedule with iOS-style date strip and quick booking.
- ART STUDIO remains an add-on; Salon OS stays the main product.

This repository is the source of truth for ongoing LUDIA NAIL updates. Vercel should deploy the `main` branch automatically.
