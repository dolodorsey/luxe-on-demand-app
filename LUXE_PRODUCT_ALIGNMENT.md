# LUXE Product Alignment — Closure Gate

Status: YELLOW — product identity and backend direction are resolved; production activation proof remains.

## Canonical product

LUXE is the premium mobility/on-demand transportation product: pickup → destination → vehicle class → fare → request → driver match → ETA/live trip → payment → receipt → rating/support. Scheduled rides, airport, corporate/guest booking, favorites and concierge differentiation follow the base loop.

The prior beauty/cosmetic marketplace implementation is preserved on `archive/luxe-beauty-marketplace-2026-08-07` so no data or code is destroyed. It is no longer the canonical LUXE product direction.

## Backend decision

LUXE mobility shares the same physical Supabase project as ON CALL, `wfkohcwxxsrhcxhepfql`, by explicit user direction. This avoids another paid project while keeping the products logically separate.

Namespace boundary is mandatory:
- ON CALL: `oc_*` tables/RPCs and `oc-*` Edge Functions.
- LUXE mobility: `lm_*` tables/RPCs and `luxe-mobility-*` Edge Functions.

The shared project is infrastructure only. LUXE and ON CALL must never share business-domain tables, provider records, request records, payment ledgers, or product logic.

## Current closure gate

The mobility schema, rider surface, driver surface, dispatch lifecycle, payment-function code, webhook code, health function and controlled lifecycle proof exist. The next acceptance gates are live routing credentials, LUXE mobility Stripe credentials, real driver activation, full production rider/driver proof, and promotion of the verified mobility build to the LUXE production surface.
