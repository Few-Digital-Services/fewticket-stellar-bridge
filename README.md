<div align="center">

# 🌉 Fewticket Stellar Bridge

**Blockchain-powered payment infrastructure for the Fewticket platform**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Stellar SDK](https://img.shields.io/badge/Stellar_SDK-latest-7B66FF?style=flat-square&logo=stellar)](https://stellar.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis_queues-FF4444?style=flat-square)](https://docs.bullmq.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)](https://docker.com)

</div>

---

Fewticket Stellar Bridge is a **NestJS microservice** that connects the Fewticket ticketing platform to the Stellar blockchain and the Bridge payment rail. It handles Stellar wallet lifecycle management, real-time payment listening via the Stellar Horizon API, virtual account provisioning through Bridge, and async job processing with BullMQ — all as a clean, self-contained service that runs alongside the Fewticket core backend.

---

## ✨ Features

| Capability | Details |
|---|---|
| 🔑 **Stellar Wallet Generation** | Generates Ed25519 keypairs via `stellar-sdk` `Keypair.random()` |
| 📡 **Live Payment Listener** | Streams Stellar Horizon transactions in real time using `Horizon.Server` SSE |
| 💸 **On-chain Payments** | Builds and submits signed Stellar transactions with `TransactionBuilder` + `Operation.payment` |
| 🪙 **Multi-asset Support** | Handles native XLM and custom assets (e.g. USDC) with `stellar-sdk` `Asset` |
| 🌐 **Bridge Integration** | Creates customers, virtual accounts, and Bridge wallets via the Bridge API |
| 🔁 **Async Job Queues** | BullMQ workers process incoming transactions and mail in the background |
| 🔐 **OAuth2 Auth** | Client credentials flow secures all internal service-to-service communication |
| 📊 **Queue Dashboard** | Bull Board UI with Basic Auth at `/admin/queues` |
| 📝 **Swagger Docs** | Auto-generated OpenAPI docs at `/api/docs` (disabled in production) |
| 🐳 **Docker Ready** | Compose setup runs live + sandbox instances side-by-side |

---

## 🔭 Stellar SDK at the Core

This service is built heavily around the **[Stellar JavaScript SDK](https://github.com/stellar/js-stellar-sdk)** (`stellar-sdk`). Here is what it powers:

### Keypair & Wallet Management
```ts
import { Keypair } from 'stellar-sdk';

const pair = Keypair.random();
// pair.publicKey()  → G...  (56-character Stellar address)
// pair.secret()     → S...  (56-character secret seed)
```
Every user wallet is an Ed25519 keypair generated deterministically by the SDK. Public keys serve as the on-chain Stellar address; the secret seed signs transactions.

### Horizon Server — Real-time Transaction Streaming
```ts
import { Horizon } from 'stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

server.transactions()
  .forAccount(platformPublicKey)
  .cursor(resumeCursor)
  .stream({ onmessage: (tx) => handleIncoming(tx) });
```
The service opens a persistent **Server-Sent Events** stream against Horizon. Only operations targeting tracked addresses are forwarded to BullMQ — everything else is dropped at the producer level.

### Building & Submitting Transactions
```ts
import { TransactionBuilder, Operation, Asset, Networks, Memo } from 'stellar-sdk';

const tx = new TransactionBuilder(sourceAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination: recipientPublicKey,
      asset: new Asset('USDC', usdcIssuerAddress),
      amount: '25.00',
    }),
  )
  .addMemo(Memo.text('order-12345'))
  .setTimeout(30)
  .build();

tx.sign(Keypair.fromSecret(platformSecret));
await server.submitTransaction(tx);
```
Payments are constructed with `TransactionBuilder`, signed locally, and broadcast to the Stellar network via `Horizon.Server.submitTransaction`.

> **How the memo completes ticket checkout**
>
> The `Memo.text` field carries the Fewticket **order ID** as a plain text string (up to 28 bytes). When a Stellar payment lands, the Horizon listener reads the memo from the incoming transaction and matches it to a pending order in the Fewticket platform. This lookup triggers the checkout completion flow — whether the customer initiated payment from the **website**, **WhatsApp**, or the **mobile app**. All three surfaces produce the same order ID, so the bridge resolves the correct order and marks the ticket as confirmed regardless of which channel was used.

### Network Selection
```ts
import { Networks } from 'stellar-sdk';

// Testnet (default)
const passphrase = Networks.TESTNET;  // 'Test SDF Network ; September 2015'

// Mainnet
const passphrase = Networks.PUBLIC;   // 'Public Global Stellar Network ; September 2015'
```
Network is selected at startup from `STELLAR_NETWORK` env var. Testnet uses the Friendbot faucet for account funding during development.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│              Fewticket Core Backend           │
└───────────────────┬──────────────────────────┘
                    │ HTTP (OAuth2 Bearer)
┌───────────────────▼──────────────────────────┐
│          Fewticket Stellar Bridge             │
│                                              │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  │
│  │  Auth   │  │   Bridge   │  │ Stellar  │  │
│  │ Module  │  │   Module   │  │ Module   │  │
│  └─────────┘  └────────────┘  └────┬─────┘  │
│                                    │         │
│  ┌─────────────────────────────────▼──────┐  │
│  │         BullMQ Queue Workers           │  │
│  │  incoming-transactions  |  mail        │  │
│  └─────────────────────────────────────┬─┘  │
└────────────────────────────────────────┼────┘
         │ Horizon SSE stream            │ Jobs
┌────────▼──────────┐          ┌─────────▼────┐
│  Stellar Network  │          │    Redis      │
│  (Horizon API)    │          │  (BullMQ)     │
└───────────────────┘          └──────────────┘
```

### Modules

| Module | Responsibility |
|---|---|
| **Auth** | OAuth2 client credentials — token issuance and validation |
| **Stellar** | Wallet generation, Horizon SSE listener, payment submission, tracked-address cache |
| **Bridge** | Customer creation, virtual accounts, Bridge wallets via Bridge API |
| **Wallet** | TypeORM entity and persistence for user wallets |
| **Queue** | BullMQ workers — incoming transaction processing and mail dispatch |
| **Queue Dashboard** | Bull Board UI protected by Basic Auth |
| **Common** | Global response interceptor, validation pipe, throttle guard |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Redis
- MySQL

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
# ── App ─────────────────────────────────────────────
PORT=5000
APP_ENV=development

# ── OAuth (internal auth) ────────────────────────────
APP_CLIENT_ID=your_client_id
APP_CLIENT_SECRET=your_client_secret

# ── Stellar SDK ──────────────────────────────────────
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK=TESTNET                   # or PUBLIC
STELLAR_PUBLIC_KEY=GABC...               # platform wallet public key
STELLAR_SECRET_KEY=SABC...               # platform wallet secret key
STELLAR_USDC_ISSUER=GDEF...              # USDC issuer address on chosen network
STELLAR_TRACKED_ADDRESS_REFRESH_MS=30000 # address cache TTL (ms)

# ── Bridge API ───────────────────────────────────────
BRIDGE_ENVIRONMENT=sandbox
BRIDGE_SANDBOX_API_KEY=your_sandbox_api_key
BRIDGE_SANDBOX_BASE_URL=https://api.sandbox.bridge.xyz/v0
BRIDGE_PRODUCTION_API_KEY=your_production_api_key
BRIDGE_PRODUCTION_BASE_URL=https://api.bridge.xyz/v0

# ── Redis (BullMQ) ───────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ── BullMQ tuning ────────────────────────────────────
BULL_INCOMING_CONCURRENCY=15
BULL_INCOMING_RATE_LIMIT_MAX=120
BULL_INCOMING_RATE_LIMIT_DURATION_MS=1000
BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT=50
BULL_DEFAULT_REMOVE_ON_FAIL_COUNT=200
BULL_INCOMING_REMOVE_ON_COMPLETE_COUNT=50
BULL_INCOMING_REMOVE_ON_FAIL_COUNT=200

# ── MySQL (TypeORM) ──────────────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=fewticket_stellar
DB_SYNC=false

# ── Queue dashboard ──────────────────────────────────
BULL_DASHBOARD_USER=admin
BULL_DASHBOARD_PASS=change_me

# ── Mail ─────────────────────────────────────────────
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

---

## 🐳 Docker Deployment

Docker Compose runs two NestJS instances simultaneously — one for **live** (production Bridge) and one for **sandbox** — sharing a single Redis container. Your MySQL database is expected to be external.

### 1. Prepare environment files

Create `.env.live` and `.env.sandbox` in the project root with their respective credentials. Docker Compose automatically injects `REDIS_HOST=redis` for container networking.

### 2. Build and start

```bash
docker compose up --build -d
```

| Service | Port | Description |
|---|---|---|
| `nestjs-app-live` | 5000 | Production Bridge mode, PM2 Runtime |
| `nestjs-app-sandbox` | 5001 | Sandbox Bridge mode, PM2 Runtime |
| `redis` | 6379 | Shared BullMQ Redis instance |

### 3. Useful commands

```bash
# Check status
docker compose ps

# Tail logs
docker compose logs -f nestjs-app-live
docker compose logs -f nestjs-app-sandbox

# Run only one instance
docker compose up --build -d nestjs-app-sandbox redis

# Stop and clean up
docker compose down
docker compose down -v   # also removes volumes
```

---

## 🔌 API Reference

### Authentication

All protected endpoints require a Bearer token obtained via the OAuth2 client credentials flow.

**`POST /oauth/token?grant_type=client_credentials`**
```
Authorization: Basic base64(client_id:client_secret)
```
```json
{
  "access_token": "generated_access_token",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Bridge Endpoints — `/bridge`

| Method | Path | Description |
|---|---|---|
| `POST` | `/bridge/customers/create` | Create a Bridge customer |
| `POST` | `/bridge/customers/create-virtual-account` | Create a customer virtual account |
| `GET` | `/bridge/customers/:customerId/virtual-accounts/:virtualAccountId/activity` | Virtual account activity |
| `POST` | `/bridge/customers/create-bridge-wallet` | Create a Bridge wallet |
| `GET` | `/bridge/customers/:customerId/wallets/:bridgeWalletId` | Get a Bridge wallet |
| `GET` | `/bridge/wallets/:bridgeWalletId/history` | Bridge wallet transaction history |

Bridge API reference: [apidocs.bridge.xyz](https://apidocs.bridge.xyz/api-reference/bridge-wallets/create-a-bridge-wallet)

### Response Envelope

All responses are wrapped by a global interceptor:

```json
{
  "statusCode": 200,
  "message": "Request successful",
  "data": {}
}
```

Endpoints that opt out of the interceptor return their raw Bridge/Stellar payloads directly.

### Developer Tools

| URL | Description |
|---|---|
| `/api/docs` | Swagger UI — disabled when `APP_ENV=production` |
| `/admin/queues` | Bull Board queue dashboard — Basic Auth protected |

---

## 🧪 Scripts

```bash
# Development
npm run start           # start normally
npm run start:dev       # watch mode

# Production
npm run build
npm run start:prod

# Code quality
npm run lint
npm run format

# Tests
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
```

---

## 🔧 Troubleshooting

| Symptom | Fix |
|---|---|
| DI / startup errors | Check module imports and provider registration; avoid `import type` for injected classes |
| Bridge API errors | Verify `BRIDGE_ENVIRONMENT`, API key, and base URL match your account |
| Queue dashboard 401 | Check `BULL_DASHBOARD_USER` and `BULL_DASHBOARD_PASS` |
| Redis connection refused | Confirm `REDIS_HOST` / `REDIS_PORT` and that Redis is running |
| MySQL connection errors | Confirm all `DB_*` vars and that the MySQL server is reachable |
| Stellar payments not detected | Confirm `STELLAR_PUBLIC_KEY` is set and the Horizon stream is connected |

---

## 🔒 Security Notes

- **Never commit** real API keys, Stellar secret seeds, or production credentials to version control.
- Use **separate** sandbox and production Bridge API keys.
- Use **separate** `.env.live` and `.env.sandbox` files; never mix them.
- Restrict `CORS` origins in production deployments.
- Rotate `BULL_DASHBOARD_PASS` and `APP_CLIENT_SECRET` regularly.

---

## 📄 License

UNLICENSED

