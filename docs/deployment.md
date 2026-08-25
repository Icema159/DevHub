# Production deployment preparation

## Status

Phase 14.3A is complete as a preparation and dependency-security triage phase. Phase 14.3B has
created and brought the Web, API, Worker, PostgreSQL/pgvector, and Redis Railway services online;
production acceptance remains in progress. Verification email delivery uses Resend HTTPS because
the selected Railway deployment tier does not provide the required outbound SMTP path.

## Selected topology

```text
Internet
  -> public Railway Web (Caddy + compiled React SPA)
       -> same-origin /api/* proxy, URI preserved
            -> private Railway API
                 -> private PostgreSQL 16 + pgvector
                 -> private Redis
                 -> Cloudflare R2 / Resend HTTPS / OpenAI

Private Railway Worker
  -> private PostgreSQL 16 + pgvector
  -> private Redis
  -> Cloudflare R2 / OpenAI
```

Only `web` receives a public domain. `api`, `worker`, `pgvector`, and `redis` remain private. The
browser uses one HTTPS origin and never receives private hostnames or provider credentials.

## Railway service blueprint

Use these lowercase service names so Railway references remain unambiguous. Every application
service uses repository root as source/build context; workspace subdirectories omit the root
lockfile, shared packages, Prisma schema, and generated-client workflow.

| Service | Exposure | Source/build | Commands | Port/health | Initial policy | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| `web` | public | root; `/apps/web/Dockerfile` | Dockerfile-owned build/start; no pre-deploy | Railway `PORT`; `/healthz` | 1 replica; `ON_FAILURE`, max 10 | private API |
| `api` | private | root; Node/Railpack | build `npm run build:api`; pre-deploy `npm run prisma:migrate:deploy`; start `npm run start:api` | Railway `PORT`; `0.0.0.0`; `/api/health` | 1 replica; `ON_FAILURE`, max 10 | pgvector, Redis, R2, Resend, OpenAI |
| `worker` | private | root; Node/Railpack | build `npm run build:worker`; start `npm run start:worker`; no pre-deploy | no HTTP port/health | 1 replica; `ON_FAILURE`, max 10; both concurrency values `1` | pgvector, Redis, R2, OpenAI |
| `pgvector` | private | `pgvector/pgvector:0.8.2-pg16` plus volume | image-owned | internal `5432`; container health | 1 stateful instance | volume `/var/lib/postgresql/data` |
| `redis` | private | Railway Redis template | template-owned | internal `6379`; template health | 1 stateful instance | template persistence |

Railway health checks gate deployment activation; they are not continuous monitoring. Web health
proves Caddy only. API health proves API and PostgreSQL connectivity, not Redis, R2, Resend, or
OpenAI. Worker readiness and continuous dependency monitoring remain deferred.

## Infrastructure creation order

1. Create the Railway project and production environment.
2. Create private PostgreSQL 16 with pgvector and attach its volume.
3. Create private Railway Redis.
4. Create staged `api`, `worker`, and `web` services from the same repository with root context;
   hold automatic first deployment until configuration is complete.
5. Configure the Web Dockerfile path and generate its Stage 1 Railway public domain.
6. During Phase 14.3B, prepare R2, Resend, OpenAI, and a generated production `CSRF_SECRET`.
7. Configure all service variables and Railway references.
8. Deploy API first so its pre-deploy migration runs.
9. Verify database version, pgvector, migrations, vector type, and API health.
10. Deploy Worker only after migrations succeed.
11. Deploy Web with its private API reference.
12. Run auth, upload/queue/RAG, storage, Resend, proxy-trust, and owner-isolation acceptance.
13. Optionally attach a custom domain later and repeat origin-dependent checks.

Reference variables can order staged changes, but independent Git-triggered deployments are not
guaranteed to be ordered. The first deployment is deliberately manual: API, Worker, Web.

## Web configuration

- Root build context; Dockerfile `/apps/web/Dockerfile`.
- No custom build, start, or pre-deploy override.
- Public networking only for Web; health `/healthz`.
- Caddy runtime target:

  ```text
  API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
  ```

The target is host plus port, without `/api`. Caddy uses `handle`, not `handle_path`, so the `/api`
prefix is preserved. API handling precedes SPA fallback. The private target exists only at Caddy
runtime and is never compiled into browser JavaScript. Railway supplies `PORT`. Production omits
`VITE_API_BASE_URL` (or uses `/`) so requests remain same-origin.

## API configuration

- Root build context.
- Build `npm run build:api`.
- Pre-deploy `npm run prisma:migrate:deploy`.
- Start `npm run start:api`.
- Private only, Railway `PORT`, health `/api/health`, one replica.
- API is the only migration owner.

The build generates Prisma Client. Phase 14.3B must verify Railway retains the root Prisma CLI for
pre-deploy. If it is pruned, use a narrow migration image or make the CLI runtime-available; never
move migrations into Worker.

## Worker configuration

- Root build context.
- Build `npm run build:worker`; start `npm run start:worker`; no pre-deploy.
- Private only; no public port/health path; one replica.
- `DOCUMENT_WORKER_CONCURRENCY=1`; `EMBEDDING_WORKER_CONCURRENCY=1`.

Worker intentionally runs through `tsx`; the isolated PDF parser Worker Thread depends on its
current TypeScript loader. Compiled output and global multi-replica concurrency remain deferred.

## PostgreSQL and pgvector plan

Railway's generic PostgreSQL template does not include extension binaries. The pgvector template
currently linked by Railway uses PostgreSQL 18, while the approved and locally tested baseline is
PostgreSQL 16. Do not silently change database major version.

Phase 14.3B should use a private service pinned to `pgvector/pgvector:0.8.2-pg16`, mount a volume at
`/var/lib/postgresql/data`, expose only internal `5432`, and provide a private `DATABASE_URL`.
Using the current PG18 template instead requires a separate compatibility decision.

Post-creation checks, without a new migration:

```sql
SHOW server_version;
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'vector';
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT format_type(a.atttypid, a.atttypmod)
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
WHERE c.relname = 'DocumentChunk' AND a.attname = 'embedding';
```

Required results: PostgreSQL major 16; vector available and installed; `prisma migrate deploy`
succeeds; `prisma migrate status` is clean; no failed `_prisma_migrations` row; embedding type is
`vector(1536)`; API and Worker connect privately.

## Redis plan

Use one private Railway Redis for BullMQ, rate limits, and protection state. API and Worker use:

```text
REDIS_URL=${{redis.REDIS_URL}}
```

The shared parser accepts `redis:`/`rediss:`, credentials, DB path, and TLS, and already sets
`family: 0` for Railway private DNS. Do not enable a public Redis URL or TCP proxy.

## Private networking plan

- Web reaches API through Railway private DNS.
- API and Worker consume only composed private `DATABASE_URL` and `REDIS_URL` references.
- API and Worker share the same R2 bucket and embedding-model configuration.
- Browser requests never target `.railway.internal`.
- Local `docker-compose.yml` remains development-only.

## Trusted proxy verification plan

Do not choose `TRUSTED_PROXY_HOPS` from the diagram. The allowed range is numeric `0..2`; never use
unrestricted `trust proxy=true`.

1. Start with `0` only as a conservative diagnostic value.
2. Temporarily log, for controlled requests only, `req.socket.remoteAddress`, inbound forwarding
   headers, `req.ip`, and `req.ips`; never log cookies, tokens, or bodies.
3. Send a normal request through public Web and repeat with candidates `0`, `1`, and `2`.
4. Choose the smallest value that resolves the real external client rather than Caddy/private IP.
5. Repeat with a forged `X-Forwarded-For: 203.0.113.10` and confirm it never becomes `req.ip`.
6. Rotate spoofed values against an IP-limited route; they must not create new rate-limit buckets.
7. Confirm API has no public route that bypasses Caddy.
8. Remove diagnostics, retain the proven value, redeploy, and repeat the focused test.

## Production environment-variable matrix

No real values are included. `Known` identifies when a value can be selected or obtained.

### Web

| Variable | Required | Secret | Source / known | Purpose |
| --- | --- | --- | --- | --- |
| `PORT` | runtime | no | Railway / after creation | Caddy listener |
| `API_UPSTREAM` | yes | internal, not secret | Railway API reference / after API creation | private host and port |
| `RAILWAY_DOCKERFILE_PATH` | only if not set in UI | no | user / now | `/apps/web/Dockerfile` |
| `VITE_API_BASE_URL` | omit or `/` | no; browser-visible | policy / now | same-origin API |

Web receives no database, Redis, R2, email-provider, OpenAI, CSRF, or session credentials.

### API

| Variable | Required | Secret | Source / known | Purpose |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | yes | no | user / now | `production` |
| `PORT` | runtime | no | Railway / after creation | listener; omit `API_PORT` |
| `TRUSTED_PROXY_HOPS` | yes | no | deployed test / later | bounded proxy trust |
| `APP_BASE_URL` | yes | no | Web domain / after creation | public links/origin |
| `CORS_ORIGIN` | yes | no | Web domain / after creation | must equal `APP_BASE_URL` |
| `CSRF_SECRET` | yes | yes | user-generated / Phase 14.3B | stable, server-only, minimum 32 characters |
| `DATABASE_URL` | yes | yes | pgvector reference / after creation | PostgreSQL |
| `REDIS_URL` | yes | yes | Redis reference / after creation | queues/protection |
| `EMAIL_DELIVERY_DRIVER` | yes | no | user / now | `resend` |
| `RESEND_API_KEY` | yes for Resend | yes | Resend / after setup | API-only HTTPS credential |
| `EMAIL_FROM` | yes for Resend | no | user / now | configurable sender identity |
| `SMTP_HOST`, `SMTP_FROM` | only for optional SMTP | host/from no | alternate provider | optional alternate delivery |
| `SMTP_PORT`, `SMTP_SECURE` | optional SMTP | no | alternate provider | defaults `587`/`false` |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | optional SMTP pair | yes | alternate provider | optional SMTP authentication |
| `STORAGE_DRIVER` | yes | no | user / now | `r2` |
| `R2_ENDPOINT`, `R2_BUCKET_NAME` | yes for R2 | internal identifiers | Cloudflare / after setup | storage target |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes for R2 | yes | Cloudflare / after setup | storage credentials |
| `MAX_UPLOAD_SIZE_BYTES` | optional | no | policy / now | default `10485760` |
| `OPENAI_API_KEY` | yes | yes | OpenAI / after setup | AI providers |
| `OPENAI_EMBEDDING_MODEL` | yes in production | no | approved config / now | `text-embedding-3-small` |
| `OPENAI_CHAT_MODEL` | yes in production | no | approved config / now | answer/title model |
| `OPENAI_CHAT_MAX_OUTPUT_TOKENS` | optional | no | policy / now | default `1200` |
| `GLOBAL_OPENAI_MONTHLY_BUDGET_USD` | optional | operationally sensitive | policy / Phase 14.3B | default `20` |

`LOCAL_STORAGE_PATH` is unused when `STORAGE_DRIVER=r2`.

### Railway Resend email configuration

Configure these variables on the **API service only**:

```text
EMAIL_DELIVERY_DRIVER=resend
RESEND_API_KEY=<secret Resend API key>
EMAIL_FROM=Developer Knowledge Hub <onboarding@resend.dev>
```

Do not add `RESEND_API_KEY` to Web, Worker, `VITE_*`, repository files, build arguments, or logs.
When the Resend driver is selected, Railway does not need `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USERNAME`, `SMTP_PASSWORD`, or `SMTP_FROM`; those settings belong only to the optional SMTP
adapter. Redeploy API after changing the variables. The temporary `onboarding@resend.dev` sender can
send test mail only to the Resend account owner's address. Before public external-user delivery,
verify a custom domain in Resend and replace `EMAIL_FROM` with an address on that domain.

### Worker

| Variable | Required | Secret | Source / known | Purpose |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | yes | no | user / now | `production` |
| `DATABASE_URL`, `REDIS_URL` | yes | yes | Railway references / after creation | DB and BullMQ |
| `DOCUMENT_WORKER_CONCURRENCY` | explicit initial | no | policy / now | `1` |
| `EMBEDDING_WORKER_CONCURRENCY` | explicit initial | no | policy / now | `1` |
| `STORAGE_DRIVER` | yes | no | user / now | `r2` |
| `R2_ENDPOINT`, `R2_BUCKET_NAME` | yes for R2 | internal identifiers | Cloudflare / after setup | same target as API |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes for R2 | yes | Cloudflare / after setup | credentials |
| `OPENAI_API_KEY` | yes | yes | OpenAI / after setup | embeddings |
| `OPENAI_EMBEDDING_MODEL` | yes in production | no | approved config / now | same as API |
| `GLOBAL_OPENAI_MONTHLY_BUDGET_USD` | optional, consistent | operationally sensitive | policy / later | app-wide budget |

Worker receives no CORS, public URL, CSRF, email-delivery, chat-model, or browser variables. PostgreSQL and
Redis own their generated credentials/private hosts and composed URLs. API and Worker consume only
the composed references. Never put any secret in `VITE_*`, repository files, build arguments,
screenshots, logs, or documentation.

## Session and CSRF secret clarification

There is no `SESSION_SECRET`, and none is required. Each session uses random opaque bytes; only the
SHA-256 hash is stored in PostgreSQL, while the raw value travels only in the backend-managed
HttpOnly cookie. Production uses a host-only Secure `SameSite=Lax` cookie at path `/`.

`CSRF_SECRET` is required. It HMACs the active session credential to produce a session-bound token.
It must be at least 32 characters, stable across restarts/replicas, server-only, and generated in
Phase 14.3B. The browser keeps only the derived token in memory and sends `X-CSRF-Token`.

## Domain and HTTPS plan

Stage 1 uses the generated Web `*.up.railway.app` domain. Set `APP_BASE_URL` and `CORS_ORIGIN` to
that same exact HTTPS origin, leave production `VITE_API_BASE_URL` unset, and verify cookies, CSRF,
same-origin proxying, and email links.

Stage 2 optionally adds a custom portfolio domain. After Railway TLS/DNS is valid, update both API
origin variables together and repeat auth/CSRF/CORS/email acceptance. Host-only cookies do not move
to the new hostname, so re-login is expected. Existing verification links keep their original host
for their 60-minute lifetime.

## Production dependency security status

Before remediation, `npm audit --omit=dev` reported 10 vulnerable package nodes: 0 critical,
6 high, 4 moderate. Direct boundaries were React Router 7.18.1 and Nodemailer 7.0.13; the other
nodes are carried by Prisma CLI/build/pre-deploy dependencies.

Classification: A = must fix; B = should fix; C = temporary documented acceptance; D =
development/unreachable.

| Advisory | Package/version before | Severity | Range/fix | Product reachability | Class / decision |
| --- | --- | --- | --- | --- | --- |
| GHSA-qwww-vcr4-c8h2 | direct `react-router` 7.18.1 | high | `>=7.12 <7.18.2`; fixed 7.18.2 | unstable RSC only; this SPA uses declarative routing | B; updated exactly to 7.18.2 |
| GHSA-p6gq-j5cr-w38f | direct `nodemailer` 7.0.13 | high | `<=9.0.0`; fixed 9.0.1 | requires attacker-influenced `raw`; sender never uses it | B; updated to 9.0.5 |
| GHSA-c7w3-x93f-qmm8 | direct `nodemailer` 7.0.13 | low | `<8.0.4`; fixed 8.0.4 | no custom envelope size | B; cleared by 9.0.5 |
| GHSA-vvjj-xcjg-gr5g | direct `nodemailer` 7.0.13 | moderate | `<=8.0.4`; fixed 8.0.5 | no custom EHLO name | B; cleared by 9.0.5 |
| GHSA-r7g4-qg5f-qqm2 | direct `nodemailer` 7.0.13 | moderate | `<=8.0.7`; fixed 8.0.8 | no OAuth2 | B; cleared by 9.0.5 |
| GHSA-268h-hp4c-crq3 | direct `nodemailer` 7.0.13 | moderate | `<=8.0.8`; fixed 8.0.9 | no `List-*` comments | B; cleared by 9.0.5 |
| GHSA-wqvq-jvpq-h66f | direct `nodemailer` 7.0.13 | moderate | `<=8.0.8`; fixed 8.0.9 | no JSON transport | B; cleared by 9.0.5 |
| GHSA-92pp-h63x-v22m | transitive `@hono/node-server` 1.19.11 | moderate | `<1.19.13`; fixed 1.19.13 | Prisma tooling only; no Hono server | D; defer coordinated Prisma maintenance |
| GHSA-frvp-7c67-39w9 | transitive `@hono/node-server` 1.19.11 | moderate | `<1.19.15`; fixed 1.19.15 | Prisma tooling; Windows static-server path absent | D; defer |
| GHSA-ggr8-5vv4-36mx | transitive `deepmerge-ts` 7.1.5 | high | `<8.0.0`; fixed 8.0.0 | trusted Prisma config, not request input | D; no unsupported override |
| GHSA-v2hh-gcrm-f6hx | transitive `fast-uri` 3.1.3 | high | `>=3 <=3.1.3`; fixed after 3.1.3 | Prisma streams/Ajv tooling only | D; defer |
| GHSA-7p8r-x3mc-p8w7 | transitive `fast-uri` 3.1.3 | high | `>=3 <3.1.5`; fixed 3.1.5 | same tooling-only path | D; defer |
| GHSA-8j4g-w8fx-2239 | transitive `hono` 4.12.30 | moderate | `<4.12.34`; fixed 4.12.34 | app HTTP server is Express | D; defer |
| GHSA-f23p-vx2j-j53r | transitive `hono` 4.12.30 | moderate | `>=3.8 <4.12.34`; fixed 4.12.34 | no Hono SSR/`memo()` | D; defer |
| GHSA-79qm-7rj5-m7r9 | transitive `hono` 4.12.30 | low | `>=4.7 <4.12.34`; fixed 4.12.34 | Caddy/Express, not Hono proxy helper | D; defer |
| GHSA-54fx-42gc-7vw4 | transitive `hono` 4.12.30 | moderate | `>=4.12 <4.12.34`; fixed 4.12.34 | no Hono language middleware | D; defer |
| GHSA-5qjj-4xww-7phc | transitive `valibot` 1.2.0 | moderate | `<=1.4.1`; fixed 1.4.2 | Prisma scanner only; app uses Zod/custom validation | D; defer |

Nodemailer messages contain only fixed `from`, `to`, `subject`, and plain `text`; they do not use
raw messages, files/URLs, attachments, custom envelopes/EHLO, List headers, JSON transport, or
OAuth2. The upgrade remains appropriate because SMTP is still a supported optional adapter even
though Railway production now uses Resend HTTPS.

The aggregate `prisma`, `@prisma/config`, and `@prisma/dev` nodes inherit the D findings rather than
adding independent reachable advisories. Prisma remains aligned at 7.8.0. Prisma 7.9.1 reduces the
scanner chain but still carries vulnerable `deepmerge-ts`; forced transitive overrides or a partial
Prisma update are not justified.

After remediation, `npm audit --omit=dev` reports 8 package nodes: 0 critical, 4 high, 4 moderate.
All are in the Prisma CLI/build/pre-deploy chain. This removes both direct runtime findings; it does
not claim a numerically clean audit. `npm audit fix --force` was not used.

## Phase 14.3B user action checklist

- Create/sign in to Railway and create the project/environment.
- Approve the PostgreSQL 16 pgvector image plan instead of silently adopting PG18.
- Create private PostgreSQL and Redis services.
- Connect the repository and stage Web/API/Worker without premature automatic deploys.
- Create a private R2 bucket and least-privilege credentials.
- Create a Resend API key and configure an approved sender. `onboarding@resend.dev` is limited to
  account-owner testing; verify a custom domain before sending to external users.
- Create/select an OpenAI project/key and configure billing/spend limits.
- Generate a new stable production `CSRF_SECRET`.
- Generate and approve the temporary Railway Web domain.
- Decide whether/when to use a custom portfolio domain.
- Review the one-replica/restart plan and select backup/restore and rollback policies.

## Remaining Phase 14.3B acceptance and deferred work

Phase 14.3B must still prove private exposure, PG16/pgvector/migrations/`vector(1536)`, Prisma CLI
availability in pre-deploy, real R2/Resend/OpenAI paths, spoof-resistant proxy trust, health,
auth/cookie/CSRF, upload/processing/RAG/delete, owner isolation, and a real verification-email smoke
test through Resend HTTPS. Worker readiness, continuous dependency monitoring, backups/restore, rollback, structured
observability, CI/CD, and global multi-replica concurrency remain deferred.

## References

- [Railway monorepos](https://docs.railway.com/deployments/monorepo)
- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway private networking](https://docs.railway.com/networking/private-networking)
- [Railway domains](https://docs.railway.com/networking/domains/working-with-domains)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway restart policy](https://docs.railway.com/deployments/restart-policy)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway Redis](https://docs.railway.com/databases/redis)
- [Railway PostgreSQL extensions](https://docs.railway.com/databases/postgresql)
- [Railway-linked pgvector template](https://railway.com/deploy/3jJFCA)
- [React Router advisory](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
- [Nodemailer high advisory](https://github.com/advisories/GHSA-p6gq-j5cr-w38f)
