# LUXE Mobility Closure Evidence

Status: YELLOW — mobility base built, controlled lifecycle proven, and the user-approved shared production backend is established. Live routing, Stripe configuration, real driver supply, and a production ride proof remain.

## Canonical product direction

LUXE is being closed as a premium mobility product, not a cosmetic-services marketplace. The archived beauty implementation is preserved separately and has not been deleted.

## Shared physical backend, separate logical products

LUXE mobility now shares the physical Supabase project used by ON CALL: `wfkohcwxxsrhcxhepfql` (`KOLLECTIVE BOH`). This is intentional and user-approved.

The brands remain logically isolated:
- ON CALL uses the `oc_*` namespace and `oc-*` Edge Functions.
- LUXE mobility uses the `lm_*` namespace and `luxe-mobility-*` Edge Functions.

No LUXE mobility table, RPC, or Edge Function reuses ON CALL's business-domain tables. Sharing is infrastructure only, not brand/data-model consolidation.

The shared project currently contains 14 `oc_*` tables and 7 `lm_*` tables. LUXE has three seeded vehicle classes and no fabricated production profiles, drivers, or rides.

## Backend contract established

The closure branch contains a portable mobility schema under `supabase/migrations/20260807161000_luxe_mobility_core.sql` plus driver runtime support under `20260807162000_luxe_mobility_driver_runtime.sql`.

Core records include rider/driver profiles, vehicle classes, verified driver supply and duty state, rides, immutable ride events, payment ledger, and ratings.

Server functions cover rider onboarding, fare quoting, supply-gated ride requests, driver offers, atomic acceptance, ordered trip transitions, cancellation, rating, and active-driver trip retrieval. The ride request path fails closed when no approved, on-duty, payout-ready driver exists for the requested class.

RLS is enabled on the `lm_*` tables. Direct protected writes are blocked for browser clients; authenticated app actions use ownership-checked mobility RPCs or server-side Edge Functions. `lm_drivers` and `lm_ride_events` intentionally have no browser read policies because those records are server/RPC controlled.

## LUXE mobility Edge Functions in the shared project

The following functions are ACTIVE in `wfkohcwxxsrhcxhepfql`:
- `luxe-mobility-payments` — JWT required
- `luxe-mobility-stripe-webhook` — signed Stripe webhook endpoint
- `luxe-mobility-health` — public bounded health endpoint

The payment function fails closed when `LUXE_MOBILITY_STRIPE_SECRET_KEY` is absent. The webhook fails closed when the LUXE mobility Stripe secret or webhook signing secret is absent.

## Controlled lifecycle proof executed

Before the shared-backend production binding, a temporary QA rider and QA driver were created in enterprise staging with no external notifications and no real payment method.

The controlled trip test produced ride ID `8081078e-3f66-4f46-aa1b-14281348f07f` with class `luxe_black`, pickup `123 Peachtree St NE, Atlanta, GA`, destination `6000 N Terminal Pkwy, Atlanta, GA`, route 12.4 miles / 28 minutes, server quote `$57.50`, atomic driver acceptance, controlled 5,750-cent payment-ledger authorization, and ordered `en_route → arrived → in_progress → completed` transitions. The completed fare remained `$57.50`.

The event ledger recorded `ride_requested`, `driver_accepted`, `en_route`, `arrived`, `in_progress`, and `completed` in order. All QA rider/driver/ride/payment/event records were deleted afterward. This proves the database lifecycle only and is not represented as a real customer ride or Stripe transaction.

## Mobility application surface

The closure branch homepage now routes authenticated identities to the LUXE rider or driver experience. The mobility surface includes confirmation-safe rider authentication, pickup/destination, vehicle-class selection, server fare quotes, ride requests, active trip state, payment authorization entry, cancellation, history, rating, driver offers, driver acceptance, and ordered trip-state controls.

A routing adapter is implemented, but production routing credentials still need verification before route distance/duration can be treated as live-production evidence.

## Build proof

The LUXE closure branch is bound to `wfkohcwxxsrhcxhepfql` through `src/config/luxe-mobility-backend.ts` with backend mode `shared-on-call-project`.

Vercel preview deployment `dpl_6QEyhMTeX7esJoEWaRzaDyYcfB1F` for commit `759a765a3e43fe14bff1740e80c2ff158763c2fb` reached READY after the shared-backend switch. A subsequent health-reporting commit `bd3371ee258b02c98c63a5d79a279870fff4d1c2` also deployed on the same closure branch.

## Not yet claimed complete

LUXE is not GREEN until live routing/geocoding is credentialed and verified, LUXE mobility Stripe authorization/capture/webhook credentials are configured and proven, at least one approved real or controlled production driver and rider complete the full release path, and the verified mobility build replaces the legacy beauty implementation on the production LUXE surface without data loss.
