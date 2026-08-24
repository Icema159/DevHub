# ADR-0011: Use revocable server-side sessions and verified email capability

- Status: Accepted
- Date: 2026-08-18

## Context

The original MVP transported a signed access JWT in an HttpOnly cookie. Signature, issuer,
audience, and expiry checks prevented tampering, but logout only removed the browser copy. A copied
JWT remained valid until expiry because the server had no authoritative revocation state.

The hosted portfolio demo also needs proof that an account controls its email before it can consume
storage and AI resources, and anonymous authentication endpoints need shared abuse controls across
API instances.

## Options considered

1. Keep short-lived JWTs and accept the revocation window.
2. Add access-token and refresh-token rotation.
3. Add a JWT denylist in Redis.
4. Replace browser authorization with opaque PostgreSQL-backed sessions.
5. Use a vendor-owned identity platform for sessions and email verification.

## Decision

Use an opaque server-side session credential. Generate 32 random bytes, encode with base64url, send
the raw token only in an HttpOnly cookie, and store only its SHA-256 hash in PostgreSQL. Every
authenticated request resolves a non-revoked, unexpired `Session` and its current `User`. Sessions
have a seven-day absolute lifetime, do not slide, and are not cached in Redis. Logout revokes the
current session before clearing the cookie; an internal operation can revoke every session for a
user.

Add nullable `User.emailVerifiedAt` and separate hashed, 60-minute, single-use
`EmailVerificationToken` records. Registration remains sessionless and returns one generic accepted
response for new and existing emails. Unverified sessions may manage basic account/data state, but
cannot upload or reprocess documents, run semantic search, or generate AI answers.

Use a small email-sender interface with capture adapters in tests, guarded console delivery in
local development, and provider-neutral SMTP in production. Verification links use an explicit
trusted application base URL and carry the token in a frontend URL fragment.

Use Redis only for atomic fixed-window authentication limits. Session authority remains in
PostgreSQL. Limiter storage failure is fail-closed for the protected authentication endpoint rather
than silently disabling the control.

## Consequences

- A copied credential becomes unusable immediately after its session is revoked.
- Every protected request adds one indexed PostgreSQL lookup; this is intentional until measurement
  justifies another design.
- Multiple device sessions coexist, while logout affects only the current session.
- Existing local JWT cookies stop working and users must sign in again.
- Existing local accounts start unverified because there is no trustworthy historical verification
  evidence.
- Email delivery cannot be atomic with PostgreSQL. A failed initial delivery leaves the account
  unverified but recoverable through authenticated resend.
- The existing unused `RefreshToken` table remains temporarily for additive migration safety. It is
  not a valid authentication mechanism and should be removed in a later cleanup migration.
- Per-IP and per-identity limits reduce ordinary abuse but do not replace later product quotas,
  global provider budgets, or distributed-attack controls.

## Review trigger

Revisit the design if measured session lookup load requires caching, account-security features need
session inventory or security epochs, password reset/change requires broader revocation semantics,
the deployment topology requires explicit proxy trust, or a production mail provider requires a
specialized adapter.
