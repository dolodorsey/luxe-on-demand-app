# Withdrawn approval guard

Run `python3 tests/withdrawal-guard/check.py`. Set PG_BIN to a PostgreSQL 17 bin directory if needed. The runner creates and removes a disposable socket-only cluster, loads the actual pending migration, and checks 15 outcomes including unchanged application/profile/driver tables on withdrawal rejection and explicit review followed by approval.

Fixture columns were captured October 4, 2026; 18 production constraints were reconfirmed October 10. Auth and operator checks are stubs. This is not full-schema, RLS, operator-authority, concurrency or production approval proof. The migration remains undeployed. Repeated approval resets, suspension reactivation and incompatible profile conversion remain unresolved. Human owner, operator scope, independent review and release authority remain required.
