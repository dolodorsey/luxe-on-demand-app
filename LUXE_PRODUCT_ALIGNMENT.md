# LUXE Product Alignment — Closure Gate

Status: RED — product identity mismatch

## What production is today

The currently connected `luxe-on-demand-app` is implemented as a premium beauty/cosmetic services marketplace. Its customer flow selects cosmetic/personal-care services, dispatches verified stylists/providers, and uses a service-booking/Stripe Connect lifecycle.

The production Vercel project is `luxe-on-demand-app` and the repo is bound to Supabase project `dzlmtvodpyhetvektfuo` (MCP Gateway). The connected LUXE tables there are provider recruiting/supply structures; the beauty marketplace core also uses `cs_*` stylist/payment tables.

A separate `luxe_*` schema exists in the S.O.S. Supabase project, but its categories, services, providers, concierges, requests, payments, and waitlist are currently empty. It is not an operational luxury-mobility backend.

## Intended closure target

LUXE must not be treated as complete while its production product identity is unresolved. The required canonical product is the premium mobility/on-demand experience previously defined for LUXE: pickup → destination → vehicle/class → price → request → driver/provider match → ETA → live trip → payment → receipt → rating/support, with scheduled rides, airport, corporate/guest booking, favorites and concierge differentiation after the base loop works.

## Freeze rule

Do not add new beauty-marketplace features under the LUXE name. Preserve the existing implementation and its data so nothing is destroyed. No destructive rename, migration, deletion, or production rewrite should occur until the mobility surface and canonical backend are established and verified.

## Closure sequence

1. Identify or establish the canonical LUXE mobility code/data surface without deleting the existing beauty implementation.
2. Build the minimum complete mobility loop against one canonical backend.
3. Prove production with real or controlled driver/customer accounts, dispatch, tracking, fare/payment and support evidence before marking LUXE green.
