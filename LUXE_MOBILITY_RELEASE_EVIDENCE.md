# LUXE Mobility Closure Evidence

Status: YELLOW — mobility base built and controlled backend lifecycle proven; dedicated production backend and live money/real-driver proof still required.

## Canonical product direction

LUXE is now being closed as a premium mobility product, not a cosmetic-services marketplace. The archived beauty implementation is preserved separately and has not been deleted.

## Backend contract established

The closure branch contains a project-portable mobility schema under `supabase/migrations/20260807161000_luxe_mobility_core.sql` plus driver runtime support under `20260807162000_luxe_mobility_driver_runtime.sql`.

Core records include:
- rider/driver profiles
- vehicle classes
- verified driver supply and on-duty state
- rides
- immutable ride events
- payment ledger
- ratings

Core server functions cover:
- rider profile onboarding
- fare quoting
- supply-gated ride request
- available driver offers
- atomic driver acceptance
- ordered trip transitions
- rider cancellation
- rating
- active driver trips

The request path fails closed when no approved, on-duty, payout-ready driver exists for the requested vehicle class.

## Controlled staging backend

Because a dedicated paid LUXE Supabase project has not yet been authorized, the closure branch is bound only to `MCP Gateway Enterprise Staging` (`ofjsmkwasvztxjdzjvvf`) for controlled QA. This is not the intended production backend and must not be promoted as canonical production infrastructure.

The existing beauty implementation keeps its old Gateway binding so archived routes can still compile during migration. Mobility code uses a separate staging binding.

## Controlled lifecycle proof executed

A temporary QA rider and QA driver were created in staging with no external notifications and no real payment method.

The controlled trip test produced ride ID `8081078e-3f66-4f46-aa1b-14281348f07f` with:
- class: `luxe_black`
- pickup: `123 Peachtree St NE, Atlanta, GA`
- destination: `6000 N Terminal Pkwy, Atlanta, GA`
- route: 12.4 miles / 28 minutes
- server quote: `$57.50`
- request status: `matching`
- atomic driver acceptance: passed
- controlled payment-ledger authorization: 5,750 cents
- ordered states: `en_route → arrived → in_progress → completed`
- completed final fare: `$57.50`

The event ledger recorded `ride_requested`, `driver_accepted`, `en_route`, `arrived`, `in_progress`, and `completed` in order.

All QA rider/driver/ride/payment/event records were deleted after evidence collection. Post-cleanup verification returned zero QA rides and zero QA profiles remaining.

This proves the database lifecycle only. It is not represented as a real customer ride or real Stripe transaction.

## Mobility customer surface

`src/components/LuxeMobilityApp.tsx` replaces the beauty marketplace on the closure branch homepage and provides:
- confirmation-safe rider authentication
- pickup and destination
- explicit route QA metrics
- vehicle class selection
- server fare quote
- ride request
- active trip state
- fare authorization entry point
- cancellation
- ride history
- rating
- driver offer surface

The route-distance/minutes fields are deliberately visible in closure QA because a production routing provider has not yet been connected. They must be replaced by live routing/geocoding before production GREEN.

## Build proof

Vercel preview deployment `dpl_GcyjHpCAeAvHUobPgyYrPo1m9taC` for branch `agent/luxe-mobility-closure` compiled successfully with Next.js 16.2.12 and finished TypeScript/static generation successfully. The deployment reached READY.

## Not yet claimed complete

LUXE is not GREEN until:
1. a dedicated LUXE Supabase production project is explicitly authorized and the mobility migrations are applied there;
2. live routing/geocoding replaces the closure QA route inputs;
3. mobility Stripe authorization/capture/webhook flow is deployed against rotated live credentials;
4. at least one approved real or controlled driver account and rider account complete the full production path;
5. the production mobility domain is pointed to the verified release and all old beauty-brand LUXE routes are retired or reassigned without data loss.
