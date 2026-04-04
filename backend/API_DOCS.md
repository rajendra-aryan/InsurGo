# InsurGo API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <token>`

---

## 🔐 Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register a new worker |
| POST | `/auth/login` | ❌ | Login → returns JWT |
| GET | `/auth/me` | ✅ | Get my profile |
| PATCH | `/auth/me` | ✅ | Update profile / bank account |
| POST | `/auth/heartbeat` | ✅ | Signal worker is active (GPS ping) |

### Register — Request Body
```json
{
  "name": "Rahul Kumar",
  "phone": "9876543210",
  "password": "secret123",
  "email": "rahul@example.com",
  "deliveryPlatform": "zepto",
  "platformWorkerId": "ZPT-12345",
  "avgHourlyIncome": 120,
  "weeklyAvgIncome": 5000,
  "location": {
    "lat": 19.119,
    "lng": 72.846,
    "zone": "Mumbai-Andheri-West",
    "city": "Mumbai"
  },
  "governmentIdType": "aadhaar",
  "governmentIdNumber": "1234-5678-9012",
  "bankAccount": {
    "accountNumber": "123456789012",
    "ifsc": "HDFC0001234",
    "accountHolderName": "Rahul Kumar"
  }
}
```

### Heartbeat — Request Body
```json
{ "lat": 19.119, "lng": 72.846, "speed": 18 }
```

---

## 📋 Policies

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/policies/plans` | ❌ | List all plans |
| GET | `/policies/plans/:planId/quote` | ✅ | Get personalised dynamic premium quote |
| POST | `/policies/subscribe` | ✅ | Subscribe to a plan → creates Razorpay order |
| POST | `/policies/:policyId/confirm-payment` | ✅ | Confirm payment → activate policy |
| GET | `/policies/my` | ✅ | My active + historical policies |
| DELETE | `/policies/:policyId/cancel` | ✅ | Cancel active policy |

### Subscribe — Request Body
```json
{ "planId": "<mongoDB_plan_id>" }
```

### Confirm Payment — Request Body
```json
{
  "razorpayOrderId": "order_xxxx",
  "razorpayPaymentId": "pay_xxxx",
  "razorpaySignature": "abc123..."
}
```

---

## 💸 Claims

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/claims/my` | ✅ | My claims (filter: `?status=paid`) |
| GET | `/claims/stats` | ✅ | My claim stats summary |
| POST | `/claims/manual` | ✅ | Submit manual claim for an event |
| GET | `/claims/:claimId` | ✅ | Get single claim detail |
| PATCH | `/claims/:claimId/review` | ✅ | Admin: approve or reject a manual_review claim |

### Manual Claim — Request Body
```json
{
  "eventId": "<mongoDB_event_id>",
  "gpsSnapshot": {
    "lat": 19.119,
    "lng": 72.846,
    "speed": 12,
    "accuracy": 8,
    "timestamp": "2024-08-01T10:30:00Z"
  }
}
```

### Review Claim (Admin) — Request Body
```json
{ "decision": "approve", "note": "Verified by manual check" }
```

---

## 🌦 Events

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/active` | ❌ | Currently active disruptions |
| GET | `/events/live-check` | ❌ | Poll OpenWeather + AQI right now (`?city=Mumbai`) |
| GET | `/events` | ✅ | Event history (`?type=rain&city=Mumbai`) |
| GET | `/events/:eventId` | ✅ | Event detail |
| POST | `/events/manual-trigger` | ✅ | Admin: fire a test disruption |
| PATCH | `/events/:eventId/resolve` | ✅ | Admin: close/resolve an event |

### Manual Trigger — Request Body
```json
{
  "type": "rain",
  "city": "Mumbai",
  "triggerValue": 75,
  "adminNote": "Demo for hackathon"
}
```
Supported types: `rain`, `flood`, `aqi`, `curfew`

---

## 💰 Premium

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/premium/calculate` | ❌ | Calculate dynamic premium (preview) |
| GET | `/premium/zone-risk` | ❌ | Zone risk factors across Mumbai |
| GET | `/premium/my-risk-profile` | ✅ | My risk score + premiums across all plans |
| GET | `/premium/ml-status` | ❌ | ML service health status |

### Calculate — Request Body
```json
{
  "planId": "<plan_id>",
  "zone": "Mumbai-Kurla",
  "weeklyAvgIncome": 6000,
  "kycScore": 80,
  "claimCount": 0
}
```

### ML-Aware Fields in Responses
- `quote.mlDecision`: availability, model version, decision timestamp, trigger reasons
- `policy.mlDecision`: persisted decision payload at subscription time
- `claim.mlDecision`: persisted ML decision used during claim orchestration

---

## 🔁 Automated Trigger Pipeline

The cron job runs every 15 minutes (configurable via `TRIGGER_CRON`):

```
OpenWeather API → Rain > 60mm? ──────┐
                                     ├→ Create Event → Find Eligible Workers
WAQI API → AQI > 300?  ─────────────┘    → Fraud Check → Compute Payout
                                              → Auto-Approve (score ≤ 20)
Manual Trigger (admin API) ──────────────────→ Razorpay Payout → Paid ✅
```

---

## 📊 Fraud Score Reference

| Score | Status | Action |
|-------|--------|--------|
| 0–20 | Auto-approved | Payout initiated immediately |
| 21–50 | Manual review | 24h hold for human review |
| 51–75 | Suspicious | Blocked, proof requested |
| 76–99 | High risk | Rejected + 7-day ban |
| 100 | Fraud ring | Account locked |

---

## 🚀 Quick Start

```bash
# 1. Clone and install
npm install

# 2. Copy and fill in your keys
cp .env.example .env

# 3. Seed insurance plans
npm run seed

# 4. Start server
npm run dev

# 5. Test health
curl http://localhost:5000/health
```
