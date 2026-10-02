# Driver application input boundary

Objects, arrays, booleans and numbers supplied as text fields are rejected with HTTP 400 before the application RPC. Null/non-object bodies and non-string actions are rejected. Vehicle years retain string and number support; database range validation remains authoritative. Missing text fields still reach existing RPC validation; this is not comprehensive format validation.

Run `node tests/driver-application-input-types.test.mjs` with Node 22.13+ (stripTypeScriptTypes); tested with Node 25.6.0. The 58 checks execute the actual handler with mocked authentication/storage and network disabled. They do not establish production persistence or driver approval.

Prepared against main 1a47ce98f53b01edf86af584a12e669fdd415650. Observed deployed luxe-driver-application v1 remains unchanged. JWT verification, user-scoped client, lm_* RPC, approval and payout controls are unchanged. Independent review and controlled integration QA remain pending before release.
