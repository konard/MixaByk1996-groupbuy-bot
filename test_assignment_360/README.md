# Test Assignment — Backend Developer (Node.js) — Issue #360

Implementation of the test assignment attached to
[issue #360](https://github.com/MixaByk1996/groupbuy-bot/issues/360).

## Task

Build a small payment-service backend implementing invoice creation, webhook processing with
replay protection, and fee calculation.

## Stack

- **Node.js + Express** — HTTP server
- **MongoDB (Mongoose)** — persistent storage; all monetary values stored as `Decimal128`
- **Redis** — nonce deduplication store for replay protection
- **Jest + Supertest** — test runner; MongoDB replaced by `mongodb-memory-server` in tests

## Layout

```
test_assignment_360/
├── src/
│   ├── app.js              # Express app (no listen)
│   ├── server.js           # Entry point — connects DB and starts server
│   ├── config.js           # Env-based configuration
│   ├── db/
│   │   └── redis.js        # Redis client singleton
│   ├── middleware/
│   │   └── rawBody.js      # Capture raw body for HMAC verification
│   ├── models/
│   │   ├── invoice.js      # Invoice schema
│   │   └── merchant.js     # Merchant schema (feePercent, balance)
│   ├── routes/
│   │   ├── invoice.js      # POST /invoice, GET /invoice/:id
│   │   └── webhook.js      # POST /webhook
│   └── utils/
│       ├── decimal.js      # Fixed-point arithmetic helpers
│       └── signature.js    # HMAC-SHA256 sign/verify
├── tests/
│   ├── setup.js            # Jest global setup (in-memory Mongo, Redis mock)
│   ├── helpers.js          # Webhook header builder
│   ├── invoice.test.js     # Invoice creation and retrieval tests
│   └── webhook.test.js     # Signature, replay protection, idempotency tests
├── .env.example
└── package.json
```

## API

### `POST /invoice` — create invoice

**Request body:**
```json
{ "amount": 100, "currency": "USD", "merchantId": "merchant-1" }
```

**Response 201:**
```json
{
  "invoiceId": "...",
  "amount": "100.00000000",
  "currency": "USD",
  "fee": "2.00000000",
  "amountToReceive": "98.00000000",
  "status": "pending"
}
```

Fee calculation: `fee = amount × feePercent` (from merchant settings), `amountToReceive = amount − fee`.

---

### `POST /webhook` — receive payment status

**Required headers:**
| Header | Description |
|---|---|
| `X-Signature` | HMAC-SHA256 hex of the raw request body, keyed with `WEBHOOK_SECRET` |
| `X-Timestamp` | Unix timestamp (seconds) of the request |
| `X-Nonce` | Random unique string per request |

**Request body:**
```json
{ "invoiceId": "...", "status": "paid" }
```
`status` must be `paid` or `failed`.

**Security checks performed:**
1. Signature verified with constant-time comparison (prevents timing attacks).
2. Timestamp freshness checked (±`WEBHOOK_TIMESTAMP_TTL` seconds, default 5 min).
3. Nonce stored in Redis with `NX`; duplicate nonce returns `409 Conflict`.
4. Invoice updated atomically from `pending → paid/failed` inside a MongoDB transaction
   (prevents double credit on concurrent duplicate deliveries).

---

### `GET /invoice/:id` — get invoice status

**Response 200:**
```json
{
  "invoiceId": "...",
  "merchantId": "merchant-1",
  "amount": "100.00000000",
  "currency": "USD",
  "fee": "2.00000000",
  "amountToReceive": "98.00000000",
  "status": "paid",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## How to run

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (default: `mongodb://localhost:27017/payment_service`)
- Redis running locally (default: `redis://localhost:6379`)

### Setup

```bash
cd test_assignment_360
cp .env.example .env
# Edit .env: set WEBHOOK_SECRET and optionally MONGODB_URI / REDIS_URL
npm install
```

### Seed a merchant (required before creating invoices)

```bash
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Merchant = require('./src/models/merchant');
  await Merchant.create({ merchantId: 'merchant-1', name: 'Demo Merchant', feePercent: mongoose.Types.Decimal128.fromString('0.02') });
  console.log('Merchant created');
  process.exit(0);
});
"
```

### Start

```bash
npm start
# or for auto-reload:
npm run dev
```

### Run tests

```bash
npm test
```

Tests use an in-memory MongoDB and a mocked Redis client — no external services needed.

## Assumptions

1. **Merchant pre-exists.** The `/invoice` endpoint looks up a merchant by `merchantId`. In a
   real system there would be a merchant registration flow; here a seed script covers it.

2. **Monetary precision.** All monetary values are stored as MongoDB `Decimal128` and arithmetic
   is done with JavaScript `Number` (IEEE-754 double, ~15 significant digits). For production
   amounts above ~$100 trillion this would need a proper BigDecimal library (e.g. `decimal.js`).
   The spec did not require production-grade precision beyond "exact calculations", so this is
   sufficient for the assignment.

3. **Exactly-once credit.** A MongoDB transaction updates the invoice status from `pending` to
   `paid/failed` atomically. If the status is already terminal the update is a no-op, so a
   second delivery (with a fresh nonce) returns 200 with the current status without double
   crediting.

4. **Redis for nonce storage.** Nonces are stored with `SET NX EX` for `2 × TTL` seconds. This
   means if two webhooks arrive with the same nonce within the TTL window the second is rejected
   with 409.

5. **No authentication / user registration** — as specified.

6. **No Docker / CI / real payment gateway** — as specified.

## What I would add given more time

- `decimal.js` library for truly exact arbitrary-precision arithmetic
- Proper idempotency key stored in MongoDB (so nonce-based deduplication survives Redis restarts)
- Merchant seeding endpoint or migration script
- Structured logging (e.g. `pino`)
- Rate limiting on `/webhook`
- OpenAPI/Swagger documentation
