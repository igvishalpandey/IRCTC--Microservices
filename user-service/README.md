# user-service

User management service for the IRCTC-clone train booking platform (microservices). Express 5 + Prisma (PostgreSQL) + Kafka.

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres kafka redis   # Postgres :5433, Kafka :9092, Redis :6379
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run dev                            # http://localhost:3001
```

Or run everything (including migrations and the service image) with `docker compose up --build`.

## Scripts

| Script                                        | Purpose                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                                 | Watch mode via `tsx`                                                   |
| `npm run build` / `start`                     | Compile to `dist/` and run it                                          |
| `npm run lint` / `typecheck` / `format:check` | Static checks (all run in CI)                                          |
| `npm test`                                    | Unit tests; integration tests also run when `TEST_DATABASE_URL` is set |
| `npm run db:migrate`                          | Create a new migration in development                                  |
| `npm run db:migrate:deploy`                   | Apply migrations (production / CI)                                     |

## API

| Method | Path                         | Notes                                             |
| ------ | ---------------------------- | ------------------------------------------------- |
| GET    | `/api/users?page=1&limit=20` | Paginated; `limit` ≤ 100                          |
| GET    | `/api/users/:id`             | `id` must be a UUID                               |
| POST   | `/api/users`                 | `{ email, name }`                                 |
| PATCH  | `/api/users/:id`             | `{ email?, name? }`                               |
| DELETE | `/api/users/:id`             |                                                   |
| GET    | `/health/live`               | Liveness probe (no dependency checks)             |
| GET    | `/health/ready`              | Readiness probe (checks DB, fails while draining) |

Errors have the shape `{ success: false, message, code, requestId, details? }`. `code` is one of
`BAD_REQUEST`, `VALIDATION_ERROR` (with field `details`), `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_ENTITY`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`
(see `utils/errors.ts`). Every response carries an
`x-request-id` header (propagated from the caller if provided) that also appears in the logs.

## Events (transactional outbox)

State changes and their events are written in the **same database transaction**: the service inserts a row
into `outbox_events`, and a background relay (`services/outbox.relay.ts`) publishes pending rows to Kafka and
marks them published. If Kafka is down, requests still succeed and events are delivered once it recovers.

- Topics: `user.created`, `user.updated`, `user.deleted`; message key = user id.
- Payload: `{ eventId, type, occurredAt, data }`. The `event-id` header equals `eventId`.
- Delivery is **at-least-once** — consumers must dedupe on `eventId`.
- A Postgres advisory lock ensures only one replica relays at a time, preserving per-user ordering.

## Redis

Optional (`REDIS_URL`). When set, API rate-limit counters live in Redis so limits are shared across replicas;
when unset, each process counts in memory. If Redis goes down, rate limiting fails open (requests are allowed
and an error is logged), `/health/ready` reports `degraded` but stays 200, and limiting resumes automatically
when Redis recovers.

## Production notes

- Configuration is validated at boot (`config/env.ts`); the process exits on invalid config.
- Run the `migrate` Docker target as a one-off job before rolling out a new app version.
- Logs are JSON on stdout (pino); authorization/cookie headers and `email`/`password`/`token` fields are redacted.
- On `SIGTERM` the service fails readiness, drains HTTP, stops the relay, and closes Kafka/Postgres,
  with a hard deadline of `SHUTDOWN_TIMEOUT_MS`.
