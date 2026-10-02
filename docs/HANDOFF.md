# Luxe On Demand Release Handoff

## Canonical identity

- Repository: `dolodorsey/luxe-on-demand-app`
- Production: `https://luxe-on-demand-app.vercel.app`
- Current authority: MCP Gateway `public.lod_*`

## Release rule

`public.lod_appointments` is authoritative for appointment identity, schedule, provider assignment, status, payment reference, and completion. Availability may propose times but cannot overwrite a confirmed appointment.

## Required checks

1. Run `npm ci`.
2. Run `node --test tests/*.test.mjs`.
3. Run `npm run build`.
4. Confirm `/health.json` returns the expected app and authority.
5. Validate client, provider, concierge, and admin role isolation.
6. Validate credentials, licensing/certification, portfolio, availability, travel radius, buffer time, and double-booking protection by service.
7. Validate deposit, capture, tip, refund, dispute, payout, messaging, reminders, cancellation, no-show, reassign, complaint, and safety escalation.
8. Record evidence in Enterprise System Control.

## Data rules

- MCP `lod_appointments` wins every conflict.
- Higher-risk cosmetic services require their own qualification, consent, and safety rules.
- New services should be enabled independently behind configuration or feature flags.
- Never expose service-role credentials to client code.

## Rollback

Revert Vercel, disable only the affected service category, stop payment/payout retries, preserve the MCP appointment, block the release gate, and reconcile every affected appointment ID.
