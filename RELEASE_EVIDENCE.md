# LUXE On Demand release evidence

## Brand and interface

- LUXE remains a standalone product and repository.
- The client landing page and provider application use approved LUXE artwork from the supplied graphics library.
- Unverified testimonials, ratings, arrival-time statistics, instant-payout claims, and the generic Stripe payment link were removed.
- The public catalog now truthfully describes the implemented 44 service options across 8 categories.
- The download page no longer serves an unverified APK or generic TestFlight link; both native releases are labeled unavailable until signed builds are verified.

## Secured marketplace foundation

- Client bookings are created through an authenticated database function using the active service catalog.
- Provider offer access requires an active, verified, on-duty stylist account.
- Offer acceptance is atomic and prevents two stylists from taking the same booking.
- Assigned jobs support accepted, en route, arrived, in progress, and completed states.
- Provider applications enter through the `luxe-provider-application` Edge Function; the private application table has RLS enabled and no client-facing policies or grants.

## Verification

- Type checking and production build pass on Next.js 16.2.12.
- Browser checks passed for the landing page and provider application, including artwork, required fields, no horizontal overflow, and no console errors.
- Incomplete application payloads return HTTP 400 and create no record.
- Release database state: 0 applications, 0 bookings, and 0 providers. No sample marketplace activity is shown as real.

## Payment gate

- Customer payment actions remain disabled and clearly say payment follows a verified invoice.
- A leaked live Stripe secret was not stored or used. Production payments require a rotated restricted secret and a separate webhook-signing secret before implementation and end-to-end testing.

## Dependency note

- The application uses the current stable Next.js release. `npm audit --omit=dev` reports upstream PostCSS advisories inside Next.js; the automated force-fix incorrectly proposes downgrading to Next 9 and was not applied.
