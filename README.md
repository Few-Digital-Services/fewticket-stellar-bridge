# Fewticket Stellar Bridge Microservice

Fewticket Stellar is a NestJS microservice for the Stellar Bridge payment rail system.
It provides secure API endpoints for customer onboarding, virtual account operations,
and Bridge wallet operations by integrating with Bridge APIs.
It is designed to communicate with the Fewticket core backend as part of a broader
payment and ticket purchasing platform.

## Current Scope

This repository is not yet a complete end-to-end payment system.

- The current implementation focuses on authenticated Bridge integration endpoints.
- Webhook handling is not yet implemented.
- The payment listener flow that will use the queue manager is not yet developed.
- This service is intended to work alongside the Fewticket core backend rather than replace it.

## What This Service Does

- Issues OAuth2 access tokens for internal/system-to-system access.
- Creates and manages Bridge customers.
- Creates customer virtual accounts.
- Creates and retrieves Bridge wallets.
- Retrieves wallet transaction history.
- Retrieves customer virtual account activity.
- Exposes queue workers and queue dashboard for background processing.
- Communicates with the Fewticket core backend for broader platform workflows.

## Tech Stack

- NestJS 11
- TypeScript
- Axios (Bridge API client)
- BullMQ + Redis
- Swagger/OpenAPI
- Class Validator / Class Transformer

## Architecture Summary

- Auth module: OAuth2 client credentials token generation and validation.
- Bridge module: all Bridge-facing operations.
- Queue module: async jobs (mail and transaction processing).
- Queue dashboard module: Bull Board with Basic Auth protection.
- Incoming Stellar payments are filtered before enqueueing so only tracked addresses are queued.
- Common module utilities:
  - global response interceptor
  - validation and custom exceptions
  - global throttling

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a .env file in the project root.

```env
# App
PORT=5000
APP_ENV=development

# OAuth client credentials
APP_CLIENT_ID=your_client_id
APP_CLIENT_SECRET=your_client_secret

# Bridge API
BRIDGE_ENVIRONMENT=sandbox
BRIDGE_SANDBOX_API_KEY=your_sandbox_api_key
BRIDGE_SANDBOX_BASE_URL=https://api.sandbox.bridge.xyz/v0
BRIDGE_PRODUCTION_API_KEY=your_production_api_key
BRIDGE_PRODUCTION_BASE_URL=https://api.bridge.xyz/v0

# Redis (BullMQ)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Producer-side Stellar address cache refresh interval (ms)
STELLAR_TRACKED_ADDRESS_REFRESH_MS=30000

# Incoming transaction queue backpressure controls
BULL_INCOMING_CONCURRENCY=15
BULL_INCOMING_RATE_LIMIT_MAX=120
BULL_INCOMING_RATE_LIMIT_DURATION_MS=1000
BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT=50
BULL_DEFAULT_REMOVE_ON_FAIL_COUNT=200
BULL_INCOMING_REMOVE_ON_COMPLETE_COUNT=50
BULL_INCOMING_REMOVE_ON_FAIL_COUNT=200

# MySQL (TypeORM)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=fewticket_stellar
DB_SYNC=false

# Queue dashboard basic auth
BULL_DASHBOARD_USER=admin
BULL_DASHBOARD_PASS=change_me

# Mail
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your_mail_user
MAIL_PASS=your_mail_password
MAIL_FROM=no-reply@example.com
```

### 3. Run in development

```bash
npm run start:dev
```

### 4. Build for production

```bash
npm run build
npm run start:prod
```

## Docker Deployment

The project includes container deployment files for running the microservice with Redis.
This does not replace local installation; npm-based setup above remains fully supported.
Docker Compose now runs two NestJS instances at the same time:

- nestjs-app-live (production Bridge mode)
- nestjs-app-sandbox (sandbox Bridge mode)

Both instances share the same Redis container.
Database is expected to be external and configured via DB_HOST and other DB_* env vars.

### Prerequisites

- Docker
- Docker Compose

### 1. Prepare environment variables

Create or update these files in the project root:

- .env.live
- .env.sandbox

When running with Docker Compose, service-to-service networking values are injected automatically:

- REDIS_HOST=redis

Compose sets Redis host to the Redis service and leaves DB_* values from your env files.

### 2. Build and start containers

```bash
docker compose up --build -d
```

This starts:

- nestjs-app-live on port 5000
- nestjs-app-sandbox on port 5001
- redis on port 6379

### 3. Check running services

```bash
docker compose ps
docker compose logs -f nestjs-app-live
docker compose logs -f nestjs-app-sandbox
```

### 4. Stop containers

```bash
docker compose down
```

### Services

- nestjs-app-live: NestJS Stellar Bridge live instance (port 5000), running with PM2 Runtime
- nestjs-app-sandbox: NestJS Stellar Bridge sandbox instance (port 5001), running with PM2 Runtime
- redis: Redis instance used by BullMQ (port 6379)

### Optional: run only one instance

```bash
# only sandbox + shared infra
docker compose up --build -d nestjs-app-sandbox redis

# only live + shared infra
docker compose up --build -d nestjs-app-live redis
```

### Optional cleanup

```bash
docker compose down -v
```

## API Docs and Operations

- Swagger UI: /api/docs
- Queue dashboard: /admin/queues

Notes:
- Swagger is disabled when APP_ENV is production.
- Queue dashboard is protected by Basic Auth using BULL_DASHBOARD_USER and BULL_DASHBOARD_PASS.

## Authentication Flow

1. Obtain a bearer token from the OAuth endpoint.
2. Call protected service endpoints with Authorization: Bearer <access_token>.

### Token endpoint

- POST /oauth/token?grant_type=client_credentials
- Header: Authorization: Basic base64(client_id:client_secret)

Example response:

```json
{
  "access_token": "generated_access_token",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Bridge Endpoints in This Service

Base route: /bridge

### Customer and Virtual Account

- POST /bridge/customers/create
  - Create a Bridge customer
- POST /bridge/customers/create-virtual-account
  - Create a customer virtual account
- GET /bridge/customers/:customerId/virtual-accounts/:virtualAccountId/activity
  - Get customer virtual account activity

### Bridge Wallet

- POST /bridge/customers/create-bridge-wallet
  - Create a Bridge wallet for a customer
- GET /bridge/customers/:customerId/wallets/:bridgeWalletId
  - Get a specific Bridge wallet
- GET /bridge/wallets/:bridgeWalletId/history
  - Get transaction history for a Bridge wallet

## Mapping to Bridge API Docs

This microservice integrates with Bridge endpoints such as:

- Create wallet: POST /customers/{customerID}/wallets
- Get wallet: GET /customers/{customerID}/wallets/{bridgeWalletID}
- Wallet history: GET /wallets/{bridgeWalletID}/history
- Virtual account activity: GET /customers/{customerID}/virtual_accounts/{virtualAccountID}/history

Reference docs:
- https://apidocs.bridge.xyz/api-reference/bridge-wallets/create-a-bridge-wallet

## Response Shape

Most endpoints are wrapped by a global response interceptor and return:

```json
{
  "statusCode": 200,
  "message": "Request successful",
  "data": {}
}
```

Endpoints decorated to skip the interceptor return raw payloads.

## Scripts

```bash
# Run
npm run start
npm run start:dev
npm run start:prod

# Quality
npm run lint
npm run format

# Tests
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Troubleshooting

- Startup fails with DI errors:
  - verify module imports and provider registration.
  - avoid using import type for runtime-injected providers.
- Bridge API errors:
  - confirm BRIDGE_ENVIRONMENT, API key, and base URL values.
- Queue dashboard unauthorized:
  - confirm BULL_DASHBOARD_USER and BULL_DASHBOARD_PASS.
- Redis connection failures:
  - confirm REDIS_HOST and REDIS_PORT and that Redis is running.
- MySQL connection failures:
  - confirm DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, and DB_DATABASE.
  - ensure your MySQL server is running and reachable from the app.

## Security Notes

- Never commit real API keys, credentials, or production secrets.
- Use separate sandbox and production Bridge credentials.
- Restrict CORS origins in production deployments.

## License

UNLICENSED
