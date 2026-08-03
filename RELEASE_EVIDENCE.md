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

- Booking-specific Stripe Connect infrastructure is implemented: manual customer authorization after stylist acceptance, capture only after completion, a 20% platform fee, and release to the assigned stylist only after Stripe confirms capture and the connected payout account is ready.
- Customers can authorize the confirmed booking total in Stripe's Payment Element and see its live state. Stylists cannot begin travel without authorization, can complete and capture assigned work, can launch Connect onboarding, and see only funds actually released as earnings.
- The payment ledger and idempotent webhook-event ledger are protected by RLS; browser clients have read-only access to their own records. Webhook writes and money movement use server credentials only.
- Cancellation, failed-payment, refund, dispute, authorization, capture, and release states are represented. Payment handling is described as authorization/capture/settlement, not legal escrow.
- Both payment Edge Functions are active and fail closed when credentials are absent. The leaked live Stripe secret was not stored or used. A rotated secret, publishable key, and separate webhook-signing secret are still required for the controlled live-money test.

## Dependency note

- The application uses Next.js 16.2.12, React 19.2.8, Supabase JS 2.112.0, Stripe Elements, and Capacitor 8.5.0.
- The production dependency audit reports zero vulnerabilities. Capacitor's CLI is development-only; its current upstream `xcode` helper has a moderate advisory that does not ship in the web or native runtime.
- Production build, iOS Capacitor synchronization, and a code-signing-disabled iOS Simulator build pass (`** BUILD SUCCEEDED **`).
- A complete Capacitor 8.5 Android project is now present and synchronized with the production web bundle and native plugins. Android compilation still requires an Android SDK and Java 21 on the release machine; neither is installed on this workstation.
- The current packages require Node 22 for release tooling.
