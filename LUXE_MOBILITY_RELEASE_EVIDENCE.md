# LUXE Mobility Closure Evidence

Status: YELLOW — the mobility software base, shared production backend, payment plumbing, routing adapter, driver application/review flow, payout onboarding, and duty controls are built. Credentialed live routing, a real Stripe transaction, real verified driver supply, and the final production promotion remain.

## Canonical product direction

LUXE is being closed as a premium mobility product, not a cosmetic-services marketplace. The former beauty implementation remains preserved on `archive/luxe-beauty-marketplace-2026-08-07` and has not been deleted.

## Shared physical backend, separate logical products

By explicit product direction, LUXE mobility shares the physical Supabase project used by ON CALL: `wfkohcwxxsrhcxhepfql` (`KOLLECTIVE BOH`).

Logical separation is enforced:
- ON CALL business data uses the `oc_*` namespace.
- LUXE mobility business data uses the `lm_*` namespace.
- LUXE customer/driver functions use `luxe-mobility-*` and `luxe-driver-*` names.
- Stripe ingress is intentionally shared through the existing ON CALL Stripe account/webhook runtime, but LUXE events are detected by LUXE PaymentIntent/account metadata and written only to the `lm_*` payment ledger.

The shared database currently has nine LUXE mobility tables: vehicle classes, profiles, drivers, rides, ride events, payments, payment events, ratings, and driver applications. There are three seeded LUXE vehicle classes and no fabricated production applicants, drivers, rides, payments, or payment events.

## Mobility lifecycle and supply gates

The portable schema and RPCs cover rider onboarding, fare quoting, supply-gated ride requests, available driver offers, atomic driver acceptance, ordered trip transitions, cancellation, rating, active-driver trips, driver status, and online/offline duty state.

A ride request fails closed unless an approved, on-duty, payout-ready driver exists for the requested class. A driver cannot go online until approval and payout readiness are both true.

RLS is enabled on protected LUXE tables. Browser access is restricted to explicit ownership policies and authenticated RPCs. Anonymous execution is denied for driver application, driver duty, and fare-quote RPCs.

## Shared Stripe runtime

LUXE now uses the existing ON CALL Stripe runtime/account rather than requiring a separate LUXE Stripe account secret.

`luxe-mobility-payments` resolves a dedicated `LUXE_MOBILITY_STRIPE_SECRET_KEY` when present and otherwise uses the shared `STRIPE_SECRET_KEY`. LUXE PaymentIntents carry `app=luxe_mobility` and `brand=LUXE` metadata and use manual capture.

The canonical shared `oc-stripe-webhook` was upgraded to route LUXE events into `lm_payment_events` / `lm_payments` while preserving the ON CALL ledger and transfer behavior. It also handles LUXE Stripe Connect `account.updated` events and only marks a LUXE driver payout-ready when Stripe reports onboarding/payout readiness.

No real/test LUXE Stripe transaction has been represented as completed yet. Payment proof remains a release gate.

## Routing

The obsolete Next.js server route was removed so the static-export mobile/web build has one routing architecture.

`luxe-mobility-route` is an authenticated Supabase Edge Function using Google Routes v2. The rider interface no longer accepts editable mileage/minute values. Pickup and destination are sent to the routing function, which returns distance and travel time for fare calculation.

The routing function fails closed with `routing_provider_unconfigured` until `GOOGLE_MAPS_ROUTES_API_KEY` exists in the runtime. No fake distance or duration is substituted. Live routing therefore remains a credential-verification gate.

## Driver activation

`lm_driver_applications` and the `/driver/apply` surface now provide a real application path without collecting license numbers or insurance policy numbers in ordinary form fields.

Approval is gated on four explicit verification states: driver license, insurance, background, and vehicle. Operator review is exposed at `/driver/review` and protected by `lm_is_operator()`, which requires owner/admin authorization. `lm_approve_driver_application` refuses approval unless all four checks are verified.

Approval creates/updates the LUXE driver profile but deliberately leaves `on_duty=false` and `payouts_enabled=false`.

`luxe-mobility-connect-onboarding` creates/reuses a Stripe Express account for an approved driver using the shared Stripe runtime. The shared webhook updates `payouts_enabled`; only then can `lm_set_driver_duty(true)` put the driver online. The `/driver` workspace exposes payout setup, status refresh, and go-online/offline controls.

No real applicant or driver was fabricated while building this flow. Current production counts remain zero applications, zero approved drivers, zero payout-ready drivers, and zero on-duty drivers.

## Controlled lifecycle proof

Before the shared-backend production binding, a temporary QA rider and QA driver in enterprise staging proved request → atomic acceptance → controlled ledger authorization → `en_route → arrived → in_progress → completed` for ride `8081078e-3f66-4f46-aa1b-14281348f07f`, quoted and completed at `$57.50`.

All QA records were deleted after evidence collection. This proves database state enforcement only; it is not represented as a real customer ride or Stripe transaction.

## Build proof

The closure branch is `agent/luxe-mobility-closure` and is bound to `wfkohcwxxsrhcxhepfql` through `src/config/luxe-mobility-backend.ts`.

Vercel preview deployment `dpl_CGb5PA1y4A6xvfASkdeabuB8Ckec` for commit `a99becd6eabdf8208ab063ab6f34ef9f5f86a95f` reached READY. Next.js 16.2.12 compiled successfully, TypeScript completed successfully, and ten static routes were generated, including `/driver`, `/driver/apply`, and `/driver/review`.

## Remaining GREEN gates

LUXE is not GREEN until:
1. `GOOGLE_MAPS_ROUTES_API_KEY` is configured and a live pickup/destination route is verified;
2. the shared Stripe runtime completes a controlled real/test LUXE authorization → webhook → capture cycle;
3. at least one real driver application passes actual verification, completes Stripe payout onboarding, and deliberately goes online;
4. a real or controlled production rider and approved driver complete the full ride path;
5. the verified mobility branch is promoted to the production LUXE surface and legacy beauty routes are retired/reassigned without data loss.
