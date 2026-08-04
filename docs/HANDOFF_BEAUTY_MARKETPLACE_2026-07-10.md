# Luxe On Demand Marketplace Handoff

**Product:** Luxe On Demand - Beauty and Cosmetic Services  
**Canonical repository:** `dolodorsey/luxe-on-demand-app`  
**Upgrade branch:** `upgrade/marketplace-foundation-2026-07`  
**Current Supabase project:** `MCP Gateway` (`dzlmtvodpyhetvektfuo`)  
**Target Supabase project:** Dedicated `LUXE ON DEMAND` project  
**Canonical Vercel project:** `luxe-on-demand-app`  
**Prepared:** July 10, 2026

## 1. Product Boundary

Luxe On Demand is an independent marketplace for beauty, grooming and approved cosmetic services.

Core operating object: **booking/appointment**  
Provider role: **stylist/professional**

Luxe must not share customer, stylist, regulated intake, payment, safety, portfolio or appointment data with S.O.S, On Call or MCP Gateway infrastructure.

## 2. Upgrade Delivered

### Security migration

```text
supabase/migrations/20260710_luxe_rls_security.sql
```

The migration:

- Enables RLS across the full `cs_*` schema.
- Protects users, stylists, bookings, offers, events, payments, earnings, regulated intake, safety, disputes and session shares.
- Separates client ownership from stylist ownership.
- Provides participant-only access to booking records.
- Keeps internal QA, promotions and integration queues server-only.
- Provides safe stylist discovery through `cs_browse_stylists` rather than exposing private stylist columns.
- Validates public waitlist intake through `cs_join_waitlist`.

### Dispatch and integrations migration

```text
supabase/migrations/20260710_luxe_dispatch_and_integrations.sql
```

The migration adds:

- LUXE-specific user profile creation for authenticated users
- Durable integration events
- Live stylist location updates
- Compliance-aware dispatch
- Expiring booking offers
- Atomic offer acceptance
- Controlled status progression
- Controlled cancellation

RPCs:

- `cs_upsert_current_user_profile`
- `cs_enqueue_integration_event`
- `cs_update_stylist_location`
- `cs_dispatch_booking`
- `cs_accept_booking_offer`
- `cs_decline_booking_offer`
- `cs_advance_booking_status`
- `cs_cancel_booking`

### Secure application client

```text
src/lib/marketplace-client.ts
```

Exports catalog, stylist discovery, profile, booking, dispatch, offer, location, status, cancellation, timeline and realtime APIs.

## 3. Compliance Boundary

Regulated services must not enter general marketplace dispatch unless:

- The service is marked regulated in `cs_subcategories`.
- Client pre-screening is complete.
- Required waiver is signed.
- Medical-director approval exists when applicable.
- State-law compliance is confirmed.
- The matched professional holds verified required credentials.
- The provider is background-checked and insured.

The dispatch RPC blocks regulated matching when these conditions are not satisfied.

This technical gate does not replace legal review. State-specific service rules must be reviewed before market activation.

## 4. Required Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not commit:

- Service-role keys
- Stripe secret keys
- Medical/compliance credentials
- License documents
- Background-check data
- Customer intake data

## 5. Dedicated Database Migration

Luxe currently sits inside MCP Gateway. This must be treated as temporary.

### Cutover plan

1. Create a new Supabase project named `LUXE ON DEMAND`.
2. Apply the canonical `cs_*` schema.
3. Apply both July 10 migrations in order.
4. Export only Luxe-owned tables, auth identities and storage assets.
5. Import and verify row counts, constraints and storage paths.
6. Create new publishable and server keys.
7. Update Vercel, iOS and Android environments.
8. Validate customer login and stylist login.
9. Validate regulated-service access separately.
10. Remove Luxe client access from MCP Gateway after cutover.

MCP Gateway keeps enterprise agents and integrations; it does not keep Luxe customer data.

## 6. Frontend Upgrade Required

The current interface still contains hard-coded services, prices, reviews, booking history and earnings examples.

Replace them with:

```text
SERVICE_TAXONOMY -> getLuxeServiceCatalog()
Featured stylists -> browseLuxeStylists()
CLIENT_HISTORY -> getLuxeBookings('client')
STYLIST_HISTORY -> getLuxeBookings('stylist') + cs_stylist_earnings
Static ratings -> cs_ratings aggregates
Static arrival claims -> live dispatch metrics
```

Until production data exists, the interface should display honest empty states rather than fictional customers, earnings or ratings.

## 7. Customer Flow

```text
Choose service
-> complete service-specific intake
-> upload inspiration photos
-> select mobile or in-studio
-> pass regulated screening when required
-> receive price/quote
-> authorize payment
-> create booking
-> dispatch now or schedule
-> track stylist/appointment
-> receive proof and completion
-> tip/rate/rebook
```

## 8. Stylist Flow

```text
Create professional profile
-> submit license/insurance/background information
-> map approved services and prices
-> configure mobile/studio availability
-> go on duty
-> publish live location for mobile work
-> receive expiring offers
-> accept atomically
-> progress through en route/arrived/started/completed
-> submit before/after proof
-> receive earnings and payout
```

## 9. Payment Upgrade Required

Remove the universal Stripe link.

Required payment architecture:

- Customer-specific Stripe Customer
- Booking-specific PaymentIntent
- Deposit or authorization rules by service
- Rush, travel, peak and add-on fees
- Client approval for price changes
- Capture at approved milestone/completion
- Platform fee
- Stripe Connect transfer
- Tip, refund and dispute handling

No payment secret belongs in the browser.

## 10. QA Gate

### Security

- [ ] Every `cs_*` table has RLS enabled.
- [ ] Direct public access to users, stylists, bookings, payments and intake is denied.
- [ ] Safe stylist discovery returns no license number, Stripe ID or internal onboarding fields.
- [ ] Client sees only owned bookings and participant records.
- [ ] Stylist sees only owned profile, offers, assigned bookings and earnings.

### Compliance

- [ ] Regulated booking cannot dispatch without approved intake.
- [ ] Unlicensed or unverified stylist cannot receive regulated offer.
- [ ] State and service credential rules are represented in the service catalog.
- [ ] Compliance status changes are auditable.

### Dispatch

- [ ] Mobile stylist location must be fresh.
- [ ] Service-mode compatibility is enforced.
- [ ] Provider-service approval is enforced.
- [ ] Offer expiration works.
- [ ] Two stylists cannot win the same booking.
- [ ] Realtime events update client and stylist apps.

### Truth in marketing

- [ ] Ratings shown come from real completed bookings.
- [ ] Arrival times come from live operational data.
- [ ] Testimonials are verified and consented.
- [ ] “Licensed” claims reflect actual verified credentials and service requirements.

## 11. Rollback

1. Keep the previous Vercel production deployment available.
2. Disable on-demand dispatch using feature flags.
3. Restore the pre-migration database branch if validation fails.
4. Block regulated-service intake rather than bypassing compliance.
5. Put booking intake into maintenance mode if assignment, payment or privacy integrity is uncertain.

## 12. Ownership

- **Product owner:** Dr. Dolo Dorsey
- **Application repository:** `dolodorsey/luxe-on-demand-app`
- **Target database owner:** Dedicated Luxe Supabase project
- **Enterprise visibility:** Health, booking SLA, compliance counts, safety and financial summaries through App Command Center.
- **Forbidden:** Direct writes to S.O.S, On Call or unrelated MCP Gateway business data.

## 13. Definition of Done

Luxe is production-ready when:

- It operates from a dedicated database.
- All visible services and prices are database-driven.
- All public social proof is verified.
- RLS and safe-field discovery are validated.
- Regulated services are technically and legally gated.
- Dispatch, payment, proof, disputes and payouts are tested.
- App Command Center health reporting is active.
